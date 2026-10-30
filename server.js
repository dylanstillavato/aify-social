import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import googleTrends from 'google-trends-api'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { montarMcp } from './mcp/servidor.js'
import * as z from 'zod'

dotenv.config()

const app = express()
app.set('trust proxy', 1) // Render sits behind a reverse proxy — needed for req.ip to reflect the real client

// Origin headers never carry a trailing slash, but it's an easy typo to make
// when pasting a URL into an env var — strip it so that mismatch can't
// silently break CORS for every request.
const FRONTEND_ORIGINS = (process.env.GOOGLE_FRONTEND_URL || 'http://localhost:5174')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))

// Aify Pictures (editor gratis en el navegador, repo aify-pictures) llama al
// MCP desde el navegador, así que /mcp acepta también sus orígenes: los de
// AIFY_PICTURES_ORIGINS (separados por comas, mismo saneado que arriba) o, sin
// la variable, la web publicada y los puertos de Vite (dev y preview). El CORS
// no abre nada por sí solo: el MCP sigue exigiendo la clave de API.
const ORIGENES_PICTURES = (process.env.AIFY_PICTURES_ORIGINS || 'https://pictures.useaify.app,http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)
const ORIGENES_MCP = [...new Set([...FRONTEND_ORIGINS, ...ORIGENES_PICTURES])]

// Antes del cors global: responde al preflight OPTIONS /mcp con las cabeceras
// que usa el transporte Streamable HTTP. El resto de rutas sigue con el de abajo.
app.use('/mcp', cors({
  origin: ORIGENES_MCP,
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
  exposedHeaders: ['Mcp-Session-Id'],
}))
// La lista de espera de la landing de Aify Pictures (POST /api/pictures/lista-espera)
// solo se llama desde Pictures; va aquí por la misma razón (el preflight).
app.use('/api/pictures/lista-espera', cors({ origin: ORIGENES_PICTURES }))
app.use(cors({ origin: FRONTEND_ORIGINS }))

// rawBody: el webhook de Instagram firma el cuerpo exacto (X-Hub-Signature-256).
app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf } }))

const MODELOS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
]

// Guiones (tarea 'guion' en /api/gemini): Gemini 4 Argon con razonamiento
// bajo (~20 s por guion, el que menos inventa y más concreto en las pruebas del
// 2026-10-23); si no responde, 3.8 Flash y después los de siempre. Piensan
// antes de responder y ese pensamiento sale del mismo maxOutputTokens, así que
// el tope va holgado para que el JSON no llegue cortado.
const MODELOS_GUION = ['gemini-4-argon', 'gemini-3.8-flash', ...MODELOS]
const CONFIG_GUION = { maxOutputTokens: 32768 }
const TIMEOUT_GUION_MS = 90000
// Los modelos de la familia 3 y 4 aceptan nivel de razonamiento; los 2.x no.
const configModelo = (modelo, { nivelRazonamiento, ...config }) => (/^gemini-(3|4)/.test(modelo) && nivelRazonamiento
  ? { ...config, thinkingConfig: { thinkingLevel: nivelRazonamiento } }
  : config)

// ── Auth + rate limiting for AI endpoints ──────────────────────────────────────
// Every generation is billed against real API keys, so we require a logged-in
// Supabase user (this proxy is otherwise reachable by anyone who finds the URL)
// and cap how many generations a single user can trigger per hour.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const supabaseAuth = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// Service-role client — bypasses RLS. Only used server-side for writes that
// touch rows the acting user isn't necessarily the owner of (tokens de redes,
// claves de IA, organizaciones).
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

async function requireAuth(req, res, next) {
  if (!supabaseAuth) {
    // Supabase not configured for this deployment — fail closed rather than
    // silently letting unauthenticated traffic through.
    return res.status(503).json({ error: 'Autenticación no disponible en el servidor' })
  }
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Sesión no válida, vuelve a iniciar sesión' })

  req.userId = data.user.id
  req.userEmail = data.user.email
  next()
}

const RATE_LIMIT_MAX = 40          // generations
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000  // per hour
const usageByUser = new Map()

function rateLimit(req, res, next) {
  const key = req.userId || req.ip
  const now = Date.now()
  const timestamps = (usageByUser.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: `Has alcanzado el límite de ${RATE_LIMIT_MAX} generaciones por hora. Inténtalo de nuevo más tarde.`,
    })
  }

  timestamps.push(now)
  usageByUser.set(key, timestamps)
  next()
}

// ── Tu IA: claves de IA de cada organización (0043 + 0053_claves_ia_proveedores.sql)
// Aify no paga IA: cada organización pone su clave de Claude (Anthropic) o de
// Gemini, y los botones de IA solo usan esas claves. La clave se guarda cifrada
// con AES-256-GCM (iv + tag + texto, en base64) con AI_KEYS_SECRET, y solo este
// servidor la descifra: ninguna respuesta devuelve la clave entera, solo sus
// últimos 4 caracteres. Sin la migración 0053 la tabla admite una sola clave
// (la de Gemini), como antes.

const PROVEEDORES_IA = ['gemini', 'anthropic']
const NOMBRE_PROVEEDOR_IA = { gemini: 'Gemini', anthropic: 'Claude' }
const MENSAJE_CONECTA_IA = 'Conecta tu IA en Configuración → Tu IA'

const AI_KEYS_SECRET = process.env.AI_KEYS_SECRET
// Cualquier texto vale como secreto: se deriva siempre una clave de 32 bytes
const claveCifradoIa = AI_KEYS_SECRET ? crypto.createHash('sha256').update(AI_KEYS_SECRET).digest() : null

class ErrorClaveIaPropia extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.estado = estado
  }
}

function cifrarClaveIa(texto) {
  const iv = crypto.randomBytes(12)
  const cifrador = crypto.createCipheriv('aes-256-gcm', claveCifradoIa, iv)
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()])
  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]).toString('base64')
}

function descifrarClaveIa(base64) {
  const datos = Buffer.from(base64, 'base64')
  const descifrador = crypto.createDecipheriv('aes-256-gcm', claveCifradoIa, datos.subarray(0, 12))
  descifrador.setAuthTag(datos.subarray(12, 28))
  return Buffer.concat([descifrador.update(datos.subarray(28)), descifrador.final()]).toString('utf8')
}

// La tabla aún no existe (migración 0043 sin aplicar)
const esTablaInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205' || /organizaciones_claves_ia/.test(error.message || ''))

// Claves descifradas de la organización: { gemini, anthropic } (null la que
// falte, o todas sin migración, sin AI_KEYS_SECRET o si no se puede
// descifrar). Nunca lanza.
async function clavesIaDeOrganizacion(organizacionId) {
  const claves = { gemini: null, anthropic: null }
  if (!supabaseAdmin || !claveCifradoIa || !organizacionId) return claves
  const { data, error } = await supabaseAdmin
    .from('organizaciones_claves_ia')
    .select('proveedor, clave_cifrada')
    .eq('organizacion_id', organizacionId)
  if (error) {
    if (!esTablaInexistente(error)) console.error('[clavesIa] error leyendo las claves:', error.message)
    return claves
  }
  for (const fila of data || []) {
    if (!PROVEEDORES_IA.includes(fila.proveedor)) continue
    try {
      claves[fila.proveedor] = descifrarClaveIa(fila.clave_cifrada)
    } catch (err) {
      console.error(`[clavesIa] no se pudo descifrar la clave de ${fila.proveedor}:`, err.message)
    }
  }
  return claves
}

// Rutas de IA: sesión (requireAuth va antes) y al menos una clave de IA de la
// organización en req.clavesIa. Sin ninguna, 402 con conectaIa para que la
// app enseñe el aviso que lleva a Configuración → Tu IA.
async function requireIaPropia(req, res, next) {
  const miembro = await miembroDeOrganizacion(req.userId)
  const claves = await clavesIaDeOrganizacion(miembro?.organizacion_id)
  if (!claves.gemini && !claves.anthropic) return res.status(402).json({ error: MENSAJE_CONECTA_IA, conectaIa: true })
  req.clavesIa = claves
  next()
}

// Con la clave de Gemini de la organización. Si Gemini dice que la clave no
// vale o que no le queda cuota, se para con un error legible.
async function llamarGeminiConFallback(prompt, generationConfig, claveApi, { modelos = MODELOS, timeoutMs = 45000 } = {}) {
  let limiteClavePropia = false
  for (const [n, modelo] of modelos.entries()) {
    const quedanModelos = n < modelos.length - 1
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${claveApi}`
      console.log(`[Server] Intentando con modelo: ${modelo}`)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      const config = configModelo(modelo, generationConfig)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: config,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await response.json()

      // Un modelo que esa clave no tiene (404) o sin cuota (429) deja paso al
      // siguiente de la lista; solo se para en el último.
      if (response.status === 404 || (response.status === 429 && quedanModelos)) {
        if (response.status === 429) limiteClavePropia = true
        console.warn(`[Server] ${modelo} no disponible con la clave (${response.status}), probando siguiente...`)
        continue
      }

      if ([400, 403, 429].includes(response.status)) {
        throw new ErrorClaveIaPropia(response.status === 429
          ? 'Tu clave de Gemini ha llegado al límite de hoy. Prueba mañana o añade tu clave de Claude en Configuración → Tu IA.'
          : 'Tu clave de Gemini no es válida o no tiene permiso. Revísala en Configuración → Tu IA.', response.status === 429 ? 429 : 400)
      }

      if (response.status === 503) {
        console.warn(`[Server] ${modelo} sobrecargado, probando siguiente...`)
        continue
      }

      if (!response.ok) {
        console.error(`[Server] ${modelo} error ${response.status}:`, data.error?.message)
        continue
      }

      console.log(`[Server] Éxito con modelo: ${modelo}`)
      return data

    } catch (error) {
      if (error instanceof ErrorClaveIaPropia) throw error
      console.error(`[Server] ${modelo} excepción:`, error.message)
      continue
    }
  }

  if (limiteClavePropia) throw new ErrorClaveIaPropia('Tu clave de Gemini ha llegado al límite de hoy. Prueba mañana o añade tu clave de Claude en Configuración → Tu IA.', 429)
  throw new ErrorClaveIaPropia('Gemini no responde con tu clave ahora mismo. Inténtalo en unos minutos.', 503)
}

// ── Claude, con la clave de Anthropic de la organización ─────────────────────

// Un cliente por clave: cada organización trae la suya.
const clienteAnthropic = (apiKey) => new Anthropic({ apiKey })

// Errores de la API de Anthropic con la clave de la organización, en claro.
function errorClaveAnthropic(error) {
  if (!(error instanceof Anthropic.APIError) || error instanceof Anthropic.APIConnectionError) return error
  if (error.status === 401 || error.status === 403) return new ErrorClaveIaPropia('Tu clave de Claude no es válida o no tiene permiso. Revísala en Configuración → Tu IA.', 400)
  if (error.status === 429) return new ErrorClaveIaPropia('Tu clave de Claude ha llegado a su límite. Prueba en un rato o revisa tu cuenta de Anthropic.', 429)
  if (error.status === 400 && /credit balance/i.test(error.message || '')) return new ErrorClaveIaPropia('Tu cuenta de Anthropic no tiene saldo. Recárgala o usa tu clave de Gemini.', 402)
  return error
}

// Sonnet 5.5 piensa antes de responder y ese pensamiento sale del mismo
// max_tokens que la respuesta, así que el tope va holgado; con streaming no
// hay riesgo de que la petición se corte por tiempo (antes se abortaba a los
// 60 s y un lote de 20 ideas no llegaba). No acepta temperature: el control
// es el nivel de esfuerzo, y "low" es el recomendado para generar contenido.
async function llamarClaudeAPI(prompt, maxTokens = 32000, apiKey) {
  let message
  try {
    const stream = clienteAnthropic(apiKey).beta.messages.stream({
      model: 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      output_config: { effort: 'low' },
      // Si los filtros de seguridad rechazan la petición, la API la reintenta
      // sola en el modelo que Anthropic recomienda para ese tipo de rechazo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    })
    message = await stream.finalMessage()
  } catch (error) {
    throw errorClaveAnthropic(error)
  }

  if (message.stop_reason === 'refusal') {
    console.warn('[Claude] Petición rechazada:', message.stop_details?.category)
    throw new Error('La IA no ha podido generar este contenido. Prueba a reformular la petición.')
  }
  if (message.stop_reason === 'max_tokens') {
    console.warn(`[Claude] Respuesta cortada al llegar a max_tokens (${maxTokens})`)
  }

  // Lo que va antes del último bloque "fallback" lo escribió un modelo que
  // rechazó a mitad de respuesta: se descarta y se queda solo la respuesta final.
  const ultimoFallback = message.content.findLastIndex(b => b.type === 'fallback')
  return message.content
    .slice(ultimoFallback + 1)
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
}

// ── Texto con la IA de la organización ───────────────────────────────────────
// Primero el proveedor preferido de la ruta y, si falla o no hay clave, el
// otro. `claves`: req.clavesIa. `generationConfig` y `opciones` son de Gemini;
// `maxTokens`, de Claude.
async function generarTextoIa(prompt, claves, { preferir = 'gemini', generationConfig = { temperature: 0.8, maxOutputTokens: 8192 }, opciones = {}, maxTokens } = {}) {
  const conGemini = async () => {
    const data = await llamarGeminiConFallback(prompt, generationConfig, claves.gemini, opciones)
    // Los modelos que piensan pueden partir la respuesta en varias partes de texto
    return (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')
  }
  const conClaude = () => llamarClaudeAPI(prompt, maxTokens, claves.anthropic)
  const orden = (preferir === 'anthropic' ? ['anthropic', 'gemini'] : ['gemini', 'anthropic']).filter(p => claves[p])
  if (orden.length === 0) throw new ErrorClaveIaPropia(MENSAJE_CONECTA_IA, 402)

  for (const [n, proveedor] of orden.entries()) {
    try {
      return proveedor === 'gemini' ? await conGemini() : await conClaude()
    } catch (error) {
      if (n === orden.length - 1) throw error
      console.warn(`[IA] ${NOMBRE_PROVEEDOR_IA[proveedor]} ha fallado con la clave de la organización, probando la otra:`, error.message)
    }
  }
}

// Error de una ruta de IA: los de la clave propia con su estado y, si falta
// la clave, con conectaIa.
function responderErrorIa(res, error) {
  const estado = error.estado || 503
  res.status(estado).json({ error: error.message, ...(estado === 402 && error.message === MENSAJE_CONECTA_IA ? { conectaIa: true } : {}) })
}

// ── POST /api/claude — texto con Claude (o con Gemini si solo hay esa clave) ─

app.post('/api/claude', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  try {
    const { prompt, maxTokens } = req.body
    const text = await generarTextoIa(prompt, req.clavesIa, { preferir: 'anthropic', maxTokens })
    res.json({ text })
  } catch (error) {
    console.error('[Claude] Error:', error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error.message)
    responderErrorIa(res, error)
  }
})

// ── POST /api/claude-vision — Claude con imágenes (Secuencias de historias) ──
// El navegador manda las fotos ya reducidas (≈640 px, JPEG) en base64 para que
// todo quepa en el límite de 2 MB de express.json. Solo con la clave de
// Claude de la organización: sin ella, 402 con conectaIa.
const VISION_MAX_IMAGENES = 10
const VISION_TIPOS = ['image/jpeg', 'image/png', 'image/webp']

app.post('/api/claude-vision', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  const { prompt, imagenes = [], maxTokens = 8000 } = req.body || {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Falta el prompt' })
  if (!Array.isArray(imagenes) || imagenes.length > VISION_MAX_IMAGENES) {
    return res.status(400).json({ error: `Como mucho ${VISION_MAX_IMAGENES} imágenes` })
  }
  if (imagenes.some(i => !VISION_TIPOS.includes(i?.mediaType) || typeof i?.data !== 'string')) {
    return res.status(400).json({ error: 'Imagen no válida' })
  }
  if (!req.clavesIa.anthropic) {
    return res.status(402).json({ error: `Analizar fotos necesita tu clave de Claude. ${MENSAJE_CONECTA_IA}`, conectaIa: true })
  }
  try {
    const content = [
      ...imagenes.flatMap((img, i) => [
        { type: 'text', text: `Foto ${i}:` },
        { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
      ]),
      { type: 'text', text: prompt },
    ]
    const stream = clienteAnthropic(req.clavesIa.anthropic).beta.messages.stream({
      model: 'claude-sonnet-5-5',
      max_tokens: Math.min(Number(maxTokens) || 8000, 16000),
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    })
    const message = await stream.finalMessage()
    const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
    res.json({ text })
  } catch (error) {
    console.error('[Claude vision] Error:', error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error.message)
    const errorClave = errorClaveAnthropic(error)
    if (errorClave instanceof ErrorClaveIaPropia) return responderErrorIa(res, errorClave)
    res.status(503).json({ error: 'La IA no ha podido analizar las fotos. Inténtalo de nuevo en unos segundos.' })
  }
})

// ── POST /api/gemini — generador principal (Gemini y, si no, Claude) ─────────

app.post('/api/gemini', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  try {
    console.log('[Gemini] Request recibido')
    const { prompt, temperature = 0.8, tarea } = req.body

    const text = tarea === 'guion'
      ? await generarTextoIa(prompt, req.clavesIa, { generationConfig: { temperature, ...CONFIG_GUION, nivelRazonamiento: 'low' }, opciones: { modelos: MODELOS_GUION, timeoutMs: TIMEOUT_GUION_MS } })
      : await generarTextoIa(prompt, req.clavesIa, { generationConfig: { temperature, maxOutputTokens: 8192 } })
    res.json({ text })

  } catch (error) {
    console.error('[Gemini] Server error:', error.message)
    responderErrorIa(res, error)
  }
})

// ── POST /api/gemini-analyze — video analysis endpoint ────────────────────────

app.post('/api/gemini-analyze', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  try {
    const { prompt } = req.body
    console.log('[Analyze] maxOutputTokens:', 8192)

    const text = await generarTextoIa(prompt, req.clavesIa, { generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } })
    console.log('[Analyze] Respuesta recibida, longitud:', text.length)
    res.json({ text })

  } catch (error) {
    console.error('[Analyze] Error:', error.message)
    responderErrorIa(res, error)
  }
})

// ── POST /api/analizar-web — business web analyzer ───────────────────────────

app.post('/api/analizar-web', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  try {
    const { url, nombreNegocio } = req.body

    const prompt = `
Eres un experto en análisis de negocios y marketing digital.

Nombre del negocio: ${nombreNegocio || 'desconocido'}
URL o perfil: ${url}

Basándote en el nombre del negocio y la URL proporcionada,
deduce toda la información posible sobre este negocio.
NO necesitas acceder a la URL — usa tu conocimiento
sobre este tipo de negocio y lo que puedes inferir
del nombre y la URL.

Si la URL es de Instagram (@usuario), deduce el tipo de negocio.
Si es una web, infiere el sector por el dominio y nombre.
Si es un nombre de restaurante, infiere la cocina y estilo.

Sé específico y útil. Mejor una estimación útil que nada.

Responde ÚNICAMENTE con JSON válido:
{
  "nombre": "nombre del negocio",
  "sector": "Restauración|Moda|Fitness|Belleza|Retail|Servicios|Educación|Tecnología|Otro",
  "sectorCustom": "si sector es Otro, especificar cuál",
  "descripcion": "descripción inferida del negocio en 2-3 frases",
  "diferencial": "posible diferencial del negocio",
  "ubicacion": "ubicación si se puede inferir de la URL o nombre",
  "web": "${url}",
  "ticketMedio": "menos_15|15_30|30_60|mas_60|no_aplica",
  "tono": "cercano_divertido|desenfadado_ironico|aspiracional|profesional_serio|energetico|familiar_calido",
  "tonoDescripcion": "descripción breve del tono detectado",
  "audiencia": {
    "edadMin": 20,
    "edadMax": 45,
    "genero": "mixto|mayoria_mujeres|mayoria_hombres",
    "descripcion": "descripción del cliente ideal",
    "valores": ["valor1", "valor2"]
  },
  "energia": "calmado|equilibrado|energetico|intenso",
  "usoEmojis": "ninguno|puntual|frecuente|muchos",
  "estetica": ["minimalista", "vintage"],
  "referenciaEstetica": "referencia estética si la hay",
  "hashtagsConocidos": ["#hashtag1"],
  "redesSociales": {
    "instagram": true,
    "tiktok": false,
    "facebook": false,
    "youtube": false,
    "googleMaps": true
  },
  "confianza": "alta|media|baja"
}

Si la confianza es baja, igualmente devuelve estimaciones razonables.
`

    // 2000 tokens was too tight for this schema (long descripcion/diferencial/
    // audiencia.descripcion fields plus two arrays) — Gemini would regularly
    // hit MAX_TOKENS mid-JSON (e.g. cut off inside hashtagsConocidos), making
    // the response permanently unparseable. Confirmed live: ~2/3 of real
    // requests failed this way before raising the limit.
    const text = await generarTextoIa(prompt, req.clavesIa, { generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }, maxTokens: 8000 })
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      console.log('[AnalizarWeb] Éxito:', parsed.nombre)
      res.json({ success: true, datos: parsed })
    } catch {
      console.warn('[AnalizarWeb] Respuesta no parseable')
      res.json({ success: false, error: 'No se pudo parsear la respuesta' })
    }

  } catch (error) {
    console.error('[AnalizarWeb] Error:', error.message)
    responderErrorIa(res, error)
  }
})

// ── POST /api/resenas-google — reseñas de un local a partir de su enlace de Maps
// Para "Voz del cliente": el gestor pega el enlace de Google Maps del negocio y
// se traen sus reseñas para sacar de ellas frases reales de clientes. Usa
// Places API (New): Text Search para encontrar el sitio y Place Details para
// las reseñas. Google solo devuelve 5 reseñas ("más relevantes") por sitio;
// para más, el gestor puede pegar el texto de las reseñas a mano.
// Sin GOOGLE_PLACES_API_KEY responde 503 con codigo 'sin_clave' y la app ofrece
// el camino de pegar el texto.

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// Solo se siguen enlaces de Google Maps (evita usar el servidor para pedir
// URLs arbitrarias): los cortos de compartir redirigen a google.com/maps/...
const HOSTS_MAPS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i

function urlDeMaps(texto) {
  try {
    const url = new URL(String(texto || '').trim())
    if (!/^https?:$/.test(url.protocol) || !HOSTS_MAPS.test(url.hostname)) return null
    if (/^(www\.)?google\./i.test(url.hostname) && !url.pathname.startsWith('/maps')) return null
    return url
  } catch {
    return null
  }
}

// Sigue a mano hasta 5 redirecciones, comprobando el host en cada salto
async function resolverEnlaceMaps(url) {
  let actual = url
  for (let i = 0; i < 5; i++) {
    const r = await fetch(actual, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
    const destino = r.headers.get('location')
    if (!(r.status >= 300 && r.status < 400 && destino)) return actual
    const siguiente = urlDeMaps(new URL(destino, actual).toString())
    if (!siguiente) return actual
    actual = siguiente
  }
  return actual
}

function datosDeEnlaceMaps(url) {
  const texto = decodeURIComponent(url.toString())
  const placeId = url.searchParams.get('query_place_id') || (texto.match(/place_id:([A-Za-z0-9_-]+)/) || [])[1] || null
  const nombre = (url.pathname.match(/\/maps\/place\/([^/]+)/) || [])[1]?.replace(/\+/g, ' ')
    || url.searchParams.get('q') || url.searchParams.get('query') || null
  // !3d/!4d son las coordenadas del sitio; @lat,lng es el centro del mapa
  const sitio = texto.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || texto.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  const coords = sitio ? { latitude: Number(sitio[1]), longitude: Number(sitio[2]) } : null
  return { placeId, nombre: nombre ? decodeURIComponent(nombre) : null, coords }
}

async function placesFetch(ruta, { method = 'GET', campos, body } = {}) {
  const r = await fetch(`https://places.googleapis.com/v1/${ruta}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': campos,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error?.message || `Places HTTP ${r.status}`)
  return data
}

app.post('/api/resenas-google', requireAuth, rateLimit, async (req, res) => {
  if (!GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ codigo: 'sin_clave', error: 'La lectura de reseñas por enlace no está activada todavía. Pega el texto de las reseñas.' })
  }
  const inicial = urlDeMaps(req.body?.url)
  if (!inicial) {
    return res.status(400).json({ codigo: 'enlace_no_valido', error: 'Pega el enlace de Google Maps del negocio (el de "Compartir").' })
  }
  try {
    const { placeId: idEnlace, nombre, coords } = datosDeEnlaceMaps(await resolverEnlaceMaps(inicial))
    let placeId = idEnlace
    if (!placeId) {
      if (!nombre) return res.status(422).json({ codigo: 'sin_sitio', error: 'No se encuentra el negocio en ese enlace. Prueba con el enlace de "Compartir" de su ficha de Maps.' })
      const busqueda = await placesFetch('places:searchText', {
        method: 'POST',
        campos: 'places.id',
        body: {
          textQuery: nombre,
          languageCode: 'es',
          ...(coords ? { locationBias: { circle: { center: coords, radius: 300 } } } : {}),
        },
      })
      placeId = busqueda.places?.[0]?.id
      if (!placeId) return res.status(404).json({ codigo: 'sin_sitio', error: 'Google no encuentra ese negocio.' })
    }
    const sitio = await placesFetch(`places/${encodeURIComponent(placeId)}?languageCode=es`, {
      campos: 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews',
    })
    const resenas = (sitio.reviews || [])
      .map(r => ({
        // originalText es lo que escribió el cliente; text puede venir traducido
        texto: (r.originalText?.text || r.text?.text || '').trim(),
        estrellas: r.rating ?? null,
        cuando: r.relativePublishTimeDescription || null,
      }))
      .filter(r => r.texto)
    res.json({
      lugar: {
        nombre: sitio.displayName?.text || nombre || '',
        direccion: sitio.formattedAddress || '',
        valoracion: sitio.rating ?? null,
        totalResenas: sitio.userRatingCount ?? null,
        url: sitio.googleMapsUri || null,
      },
      resenas,
    })
  } catch (error) {
    console.error('[resenas-google] Error:', error.message)
    res.status(502).json({ codigo: 'error_google', error: 'No se han podido leer las reseñas de Google. Prueba a pegar el texto.' })
  }
})

// ── GET /api/trends — Google Trends proxy ─────────────────────────────────────

const KEYWORDS_POR_SECTOR = {
  'Restauración': 'restaurante comida', 'Moda': 'moda tendencias',
  'Fitness': 'fitness gym', 'Belleza': 'belleza skincare',
  'Retail': 'compras tienda', 'Servicios': 'servicios empresa',
  'Educación': 'educacion cursos', 'Tecnología': 'tecnologia digital',
}

app.get('/api/trends', async (req, res) => {
  try {
    const { sector, geo = 'ES' } = req.query
    const keyword = KEYWORDS_POR_SECTOR[sector] || sector || 'marketing'

    const resultado = await googleTrends.relatedQueries({
      keyword,
      geo,
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })

    const data = JSON.parse(resultado)
    const tendencias = data.default?.rankedList?.[0]?.rankedKeyword?.slice(0, 8) || []
    res.json({ tendencias })

  } catch (error) {
    console.error('[Trends] Error:', error.message)
    res.json({ tendencias: [] })
  }
})

// ── POST /api/palabras-clave — public keyword research (SEO growth tool) ──────
// La página es pública (como /api/trends): recibe texto libre (sitio web,
// @instagram, o descripción del negocio), usa la IA para inferir el sector +
// palabras clave en español, y enriquece con búsquedas relacionadas reales de
// Google Trends para la semilla del sector. La IA es la de la organización de
// quien busca: sin sesión o sin clave, 402 con conectaIa. Solo rateLimit
// (cae a req.ip sin sesión).

// Organización del token de la petición, si lo trae y es válido. Nunca corta.
async function organizacionOpcional(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || !supabaseAuth) return null
  const { data } = await supabaseAuth.auth.getUser(token)
  if (!data?.user) return null
  const miembro = await miembroDeOrganizacion(data.user.id)
  return miembro?.organizacion_id || null
}

app.post('/api/palabras-clave', rateLimit, async (req, res) => {
  try {
    const { input } = req.body
    if (!input || !input.trim()) return res.status(400).json({ error: 'Falta describir el negocio o sitio web' })

    const organizacionId = await organizacionOpcional(req)
    const claves = await clavesIaDeOrganizacion(organizacionId)
    if (!claves.gemini && !claves.anthropic) {
      return res.status(402).json({
        error: organizacionId ? MENSAJE_CONECTA_IA : 'Crea tu cuenta gratis de Aify Social y conecta tu IA para buscar palabras clave.',
        conectaIa: true,
      })
    }

    const prompt = `
Eres un experto en SEO y marketing digital en español.

Negocio, sitio web o nicho: "${input.trim()}"

Deduce el sector y genera palabras clave que sus clientes potenciales
buscarían en Google. No necesitas acceder a la URL — infiere a partir del
texto.

Responde ÚNICAMENTE con JSON válido:
{
  "sector": "Restauración|Moda|Fitness|Belleza|Retail|Servicios|Educación|Tecnología|Otro",
  "negocio": "nombre o descripción corta del negocio en 4-6 palabras",
  "semillas": ["palabra clave 1", "palabra clave 2"],
  "keywords": [
    { "query": "palabra clave concreta que la gente busca", "valor": 85 }
  ]
}

"semillas" son 1-2 términos cortos (2-3 palabras) para explorar en Google
Trends. "keywords" son 8-10 palabras clave específicas y realistas
(long-tail incluido), con "valor" de 30 a 100 estimando qué tanto se buscan
entre sí (100 = la más buscada de tu lista, no un dato oficial).
`

    const text = await generarTextoIa(prompt, claves, { generationConfig: { temperature: 0.6, maxOutputTokens: 2000 }, maxTokens: 4000 })
    const clean = text.replace(/```json|```/g, '').trim()

    let base
    try {
      base = JSON.parse(clean)
    } catch {
      console.warn('[PalabrasClave] Respuesta IA no parseable')
      return res.json({ negocio: input.trim(), sector: 'Otro', keywords: [] })
    }

    // Enriquecer con búsquedas relacionadas reales de Google Trends —
    // mejor esfuerzo: si falla, nos quedamos solo con lo que ya generó
    // Gemini (suficiente para no dejar la página vacía).
    let trendsKeywords = []
    try {
      const semilla = base.semillas?.[0] || base.sector
      const resultado = await googleTrends.relatedQueries({
        keyword: KEYWORDS_POR_SECTOR[base.sector] || semilla,
        geo: 'ES',
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      const parsedTrends = JSON.parse(resultado)
      const ranked = parsedTrends.default?.rankedList?.[0]?.rankedKeyword || []
      trendsKeywords = ranked.slice(0, 8).map(k => ({
        query: k.query, valor: Math.min(100, Math.round(k.value || 50)), fuente: 'trends',
      }))
    } catch (err) {
      console.warn('[PalabrasClave] Trends no disponible:', err.message)
    }

    const iaKeywords = (base.keywords || []).map(k => ({ query: k.query, valor: k.valor, fuente: 'ia' }))

    // Fusiona y quita duplicados (misma query en minúsculas), quedándose
    // con el valor más alto entre las dos fuentes.
    const porQuery = new Map()
    for (const k of [...trendsKeywords, ...iaKeywords]) {
      const key = (k.query || '').toLowerCase().trim()
      if (!key) continue
      const existente = porQuery.get(key)
      if (!existente || k.valor > existente.valor) porQuery.set(key, k)
    }
    const keywords = [...porQuery.values()].sort((a, b) => b.valor - a.valor)

    res.json({ negocio: base.negocio || input.trim(), sector: base.sector || 'Otro', keywords })

  } catch (error) {
    console.error('[PalabrasClave] Error:', error.message)
    responderErrorIa(res, error)
  }
})

// ── POST /api/palabras-clave/contenido — content idea from a keyword ──────────
// Requiere login, como el resto de generadores: requireAuth + rateLimit +
// requireIaPropia.

app.post('/api/palabras-clave/contenido', requireAuth, rateLimit, requireIaPropia, async (req, res) => {
  try {
    const { keyword, negocio } = req.body
    if (!keyword) return res.status(400).json({ error: 'Falta la palabra clave' })

    const prompt = `
Eres un estratega de contenido para redes sociales en español.

Negocio: ${negocio || 'un negocio local'}
Palabra clave a aprovechar: "${keyword}"

Dame UNA idea de contenido (Reel o post) que conecte este negocio con esa
palabra clave, pensada para que alguien que busca eso en Google también lo
encuentre en redes.

Responde ÚNICAMENTE con JSON válido:
{
  "hook": "primera frase, la que se ve o escucha en los primeros 2 segundos",
  "formato": "Reel|Carrusel|Post",
  "idea": "en 2-3 frases, qué se muestra o cuenta",
  "caption": "caption corto listo para usar, con 1-2 hashtags relevantes"
}
`
    const text = await generarTextoIa(prompt, req.clavesIa, { generationConfig: { temperature: 0.8, maxOutputTokens: 800 }, maxTokens: 4000 })
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      res.json({ success: true, contenido: parsed })
    } catch {
      res.json({ success: false, error: 'No se pudo generar el contenido, intenta de nuevo' })
    }
  } catch (error) {
    console.error('[PalabrasClave/Contenido] Error:', error.message)
    responderErrorIa(res, error)
  }
})

// ── GET /api/test — health check ──────────────────────────────────────────────
// Aify ya no tiene claves de IA propias: cada organización pone la suya.

app.get('/api/test', (_req, res) => {
  res.json({
    status: 'OK',
    ia: 'clave de cada organización (Configuración → Tu IA)',
    modelos: MODELOS,
    url: 'v1beta',
  })
})

// ── GET /api/ping — diagnostics ───────────────────────────────────────────────

app.get('/api/ping', (_req, res) => res.json({ ok: true, timestamp: Date.now() }))

// ── POST /api/pictures/lista-espera — lista de espera de Aify Pictures ────────
// Público a propósito: la landing (https://pictures.useaify.app) es estática y
// no tiene servidor. CORS solo para ORIGENES_PICTURES (arriba), tabla
// lista_espera_pictures (0052) y un freno de 5 peticiones por minuto por IP.
// Apuntarse otra vez con el mismo correo no duplica: devuelve la misma posición.

const LISTA_ESPERA_MAX = 5
const LISTA_ESPERA_VENTANA_MS = 60 * 1000
const listaEsperaPorIp = new Map()

const esquemaListaEspera = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
  instagram: z.string().trim().nullish(),
  origen: z.string().trim().nullish(),
})

const esTablaListaEsperaInexistente = (error) => Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /lista_espera_pictures/.test(error.message || ''))

app.post('/api/pictures/lista-espera', async (req, res) => {
  const ahora = Date.now()
  const peticiones = (listaEsperaPorIp.get(req.ip) || []).filter(t => ahora - t < LISTA_ESPERA_VENTANA_MS)
  if (peticiones.length >= LISTA_ESPERA_MAX) {
    return res.status(429).json({ error: 'Demasiados intentos. Prueba otra vez en un minuto.' })
  }
  peticiones.push(ahora)
  listaEsperaPorIp.set(req.ip, peticiones)

  const leido = esquemaListaEspera.safeParse(req.body || {})
  if (!leido.success) return res.status(400).json({ error: 'Escribe un correo válido' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })

  // Solo los campos que llegan, para que repetir sin Instagram no borre el que ya había.
  const { email, instagram, origen } = leido.data
  const fila = { email }
  if (instagram) fila.instagram = instagram.slice(0, 200)
  if (origen) fila.origen = origen.slice(0, 200)

  const { data, error } = await supabaseAdmin
    .from('lista_espera_pictures')
    .upsert(fila, { onConflict: 'email' })
    .select('creada_en')
    .single()
  if (esTablaListaEsperaInexistente(error)) return res.status(503).json({ error: 'La lista de espera aún no está activa' })
  if (error) {
    console.error('[pictures] error guardando en la lista de espera:', error.message)
    return res.status(500).json({ error: 'No se pudo guardar el correo' })
  }

  const { count, error: errorPosicion } = await supabaseAdmin
    .from('lista_espera_pictures')
    .select('id', { count: 'exact', head: true })
    .lte('creada_en', data.creada_en)
  if (errorPosicion) {
    console.error('[pictures] error calculando la posición:', errorPosicion.message)
    return res.status(500).json({ error: 'No se pudo calcular la posición' })
  }

  res.json({ ok: true, posicion: count })
})

// ── GET /api/calendar-feed/:token.ics — per-client calendar subscription ──────
// Público a propósito: una app de Calendario (iPhone, Google Calendar...) pide
// esta URL directamente, sin sesión ni cookies — la seguridad viene de que el
// token es un UUID inadivinable (ver get_calendar_feed() en la migración
// 0012, security definer para poder saltarse RLS solo dentro de esta
// consulta concreta). Nunca requireAuth aquí, por diseño.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// RFC 5545 §3.3.11: escapa \, ; , y saltos de línea en propiedades TEXT.
function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545 §3.1: ninguna línea de más de 75 octetos — se parte con un salto
// de línea seguido de un espacio (line folding).
function foldLine(line) {
  if (line.length <= 75) return line
  let out = line.slice(0, 75)
  let rest = line.slice(75)
  while (rest.length > 0) {
    out += '\r\n ' + rest.slice(0, 74)
    rest = rest.slice(74)
  }
  return out
}

function pad2(n) { return String(n).padStart(2, '0') }

function buildIcs(calName, rows) {
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aify//Calendario de contenido//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICS(calName)} — Aify`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const row of rows) {
    if (!row.post_id) continue // fila "vacía" del left join — cliente sin posts todavía
    const [y, m, d] = row.fecha.split('-')
    lines.push('BEGIN:VEVENT', `UID:${row.post_id}@aify.app`, `DTSTAMP:${dtstamp}`)
    if (row.hora) {
      // Hora local "flotante" (sin Z ni TZID) — igual que se guarda/edita en
      // la app, sin ningún concepto de zona horaria en el resto de Aify.
      const [hh, mi] = row.hora.split(':')
      const start = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mi))
      const end = new Date(start.getTime() + 30 * 60 * 1000)
      const fmt = dt => `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`
      lines.push(`DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`)
    } else {
      // Evento de día completo — DTEND es exclusivo según el RFC, así que va
      // al día siguiente de la fecha del post.
      const fin = new Date(Number(y), Number(m) - 1, Number(d) + 1)
      lines.push(`DTSTART;VALUE=DATE:${y}${m}${d}`, `DTEND;VALUE=DATE:${fin.getFullYear()}${pad2(fin.getMonth() + 1)}${pad2(fin.getDate())}`)
    }
    lines.push(`SUMMARY:${escapeICS(row.titulo || 'Post sin título')}`)
    const descripcion = [row.concepto, row.notas].filter(Boolean).join('\n\n')
    if (descripcion) lines.push(`DESCRIPTION:${escapeICS(descripcion)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

app.get('/api/calendar-feed/:token.ics', async (req, res) => {
  const { token } = req.params
  if (!UUID_RE.test(token)) return res.status(400).send('Enlace de calendario no válido')
  if (!supabaseAuth) return res.status(503).send('Calendario no disponible')

  const { data, error } = await supabaseAuth.rpc('get_calendar_feed', { p_token: token })
  if (error) { console.error('[CalendarFeed] Error:', error.message); return res.status(500).send('Error generando el calendario') }
  if (!data || data.length === 0) return res.status(404).send('Enlace de calendario no encontrado')

  const ics = buildIcs(data[0].cliente_nombre || 'Cliente', data)
  res.set('Content-Type', 'text/calendar; charset=utf-8')
  res.set('Content-Disposition', 'inline; filename="calendario.ics"')
  res.send(ics)
})

// ─── Organización del usuario ─────────────────────────────────────────────────
// La organización vive detrás de RLS que el usuario puede no poseer (un
// miembro que no es el dueño), así que se lee con supabaseAdmin.

async function obtenerOrganizacionDelUsuario(userId) {
  if (!supabaseAdmin) return null
  const { data: miembro } = await supabaseAdmin
    .from('organizacion_miembros')
    .select('organizacion_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!miembro) return null

  const { data: organizacion } = await supabaseAdmin
    .from('organizaciones')
    .select('id')
    .eq('id', miembro.organizacion_id)
    .single()
  return organizacion || null
}

// ── /api/ia/clave — claves de IA de la organización (Tu IA) ──────────────────
// ?proveedor=gemini|anthropic (en GET y DELETE) o { proveedor } (en POST); sin
// proveedor, gemini, como antes de 0053.
// GET: cualquier miembro ve si hay clave ({ proveedor, tiene, ultimos4, verificada_en }).
// POST/DELETE: solo owner/admin. POST prueba la clave antes de guardarla.
// POST /api/ia/clave/probar: vuelve a probar la clave guardada.

async function miembroDeOrganizacion(userId) {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('organizacion_miembros')
    .select('organizacion_id, rol')
    .eq('user_id', userId)
    .maybeSingle()
  return data || null
}

const ROLES_ADMIN_ORGANIZACION = ['owner', 'admin']
const MENSAJE_SIN_MIGRACION_CLAVE = 'Falta actualizar la base de datos para guardar tu clave de IA (migración 0043).'
const MENSAJE_SIN_MIGRACION_PROVEEDORES = 'Falta actualizar la base de datos para guardar tu clave de Claude (migración 0053). Mientras, puedes usar tu clave de Gemini.'

// Sin la 0053, la tabla tiene la clave primaria solo en organizacion_id y el
// check solo admite 'gemini': el upsert por (organizacion_id, proveedor) no
// encuentra la restricción (42P10) o el check lo rechaza (23514).
const esSinMigracionProveedores = (error) => Boolean(error) && (error.code === '42P10' || error.code === '23514')

function proveedorIa(valor) {
  if (valor === undefined || valor === null || valor === '') return 'gemini'
  return PROVEEDORES_IA.includes(valor) ? valor : null
}

// Prueba una clave contra su proveedor sin generar nada: lista los modelos,
// que solo funciona con una clave válida. null si vale; si no, { estado, error }.
async function probarClaveIa(proveedor, clave) {
  const nombre = NOMBRE_PROVEEDOR_IA[proveedor]
  if (proveedor === 'anthropic') {
    try {
      await new Anthropic({ apiKey: clave, maxRetries: 0 }).models.list({ limit: 1 })
      return null
    } catch (err) {
      if (err instanceof Anthropic.APIError && !(err instanceof Anthropic.APIConnectionError)) {
        return { estado: 400, error: err.status === 429
          ? `Tu clave de ${nombre} ha llegado a su límite. Prueba en un rato.`
          : 'Anthropic no acepta esa clave. Revisa que la has copiado entera.' }
      }
      console.error('[ia/clave] no se pudo probar la clave de Claude:', err.message)
      return { estado: 502, error: 'No se pudo contactar con Anthropic para probar la clave. Inténtalo de nuevo.' }
    }
  }
  try {
    const prueba = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(clave)}`)
    if (prueba.ok) return null
    return { estado: 400, error: prueba.status === 429
      ? 'Tu clave de Gemini ha llegado al límite de hoy. Prueba mañana.'
      : 'Gemini no acepta esa clave. Revisa que la has copiado entera.' }
  } catch (err) {
    console.error('[ia/clave] no se pudo probar la clave de Gemini:', err.message)
    return { estado: 502, error: 'No se pudo contactar con Gemini para probar la clave. Inténtalo de nuevo.' }
  }
}

// Comprobaciones comunes de POST y DELETE: base de datos, organización, rol y proveedor.
async function miembroAdminParaClaveIa(req, res, proveedor) {
  if (!supabaseAdmin) { res.status(503).json({ error: 'Base de datos no disponible en el servidor' }); return null }
  if (!proveedor) { res.status(400).json({ error: 'Proveedor de IA no válido' }); return null }
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) { res.status(400).json({ error: 'No se encontró tu organización' }); return null }
  if (!ROLES_ADMIN_ORGANIZACION.includes(miembro.rol)) { res.status(403).json({ error: 'Solo el propietario de la organización puede cambiar las claves de IA' }); return null }
  return miembro
}

app.get('/api/ia/clave', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const proveedor = proveedorIa(req.query.proveedor)
  if (!proveedor) return res.status(400).json({ error: 'Proveedor de IA no válido' })
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) return res.status(400).json({ error: 'No se encontró tu organización' })

  const { data, error } = await supabaseAdmin
    .from('organizaciones_claves_ia')
    .select('ultimos4, verificada_en')
    .eq('organizacion_id', miembro.organizacion_id)
    .eq('proveedor', proveedor)
    .maybeSingle()
  if (esTablaInexistente(error)) return res.json({ proveedor, tiene: false, ultimos4: null, verificada_en: null, sinMigracion: true })
  if (error) return res.status(500).json({ error: 'No se pudo comprobar tu clave de IA' })
  res.json({ proveedor, tiene: Boolean(data), ultimos4: data?.ultimos4 || null, verificada_en: data?.verificada_en || null })
})

app.post('/api/ia/clave', requireAuth, async (req, res) => {
  if (supabaseAdmin && !claveCifradoIa) return res.status(503).json({ error: 'El servidor aún no puede guardar claves de IA (falta configurar AI_KEYS_SECRET). Avisa al equipo de Aify.' })
  const proveedor = proveedorIa(req.body?.proveedor)
  const miembro = await miembroAdminParaClaveIa(req, res, proveedor)
  if (!miembro) return

  const nombre = NOMBRE_PROVEEDOR_IA[proveedor]
  const clave = typeof req.body?.clave === 'string' ? req.body.clave.trim() : ''
  if (clave.length < 20 || clave.length > 300 || /\s/.test(clave) || (proveedor === 'anthropic' && !clave.startsWith('sk-ant-'))) {
    return res.status(400).json({ error: proveedor === 'anthropic'
      ? 'Esa clave no parece una clave de Claude (empieza por sk-ant-). Cópiala entera desde la consola de Anthropic.'
      : 'Esa clave no parece una clave de Gemini. Cópiala entera desde Google AI Studio.' })
  }

  // Se prueba antes de guardar
  const fallo = await probarClaveIa(proveedor, clave)
  if (fallo) return res.status(fallo.estado).json({ error: fallo.error })

  const ahora = new Date().toISOString()
  const fila = {
    organizacion_id: miembro.organizacion_id,
    proveedor,
    clave_cifrada: cifrarClaveIa(clave),
    ultimos4: clave.slice(-4),
    verificada_en: ahora,
    actualizada_en: ahora,
  }
  let { error } = await supabaseAdmin.from('organizaciones_claves_ia').upsert(fila, { onConflict: 'organizacion_id,proveedor' })
  // Sin la 0053: una sola clave por organización, la de Gemini, como antes
  if (esSinMigracionProveedores(error)) {
    if (proveedor !== 'gemini') return res.status(503).json({ error: MENSAJE_SIN_MIGRACION_PROVEEDORES })
    const unaSolaClave = await supabaseAdmin.from('organizaciones_claves_ia').upsert(fila, { onConflict: 'organizacion_id' })
    error = unaSolaClave.error
  }
  if (esTablaInexistente(error)) return res.status(503).json({ error: MENSAJE_SIN_MIGRACION_CLAVE })
  if (error) {
    console.error(`[ia/clave] error guardando la clave de ${nombre}:`, error.message)
    return res.status(500).json({ error: 'No se pudo guardar la clave. Inténtalo de nuevo.' })
  }
  res.json({ proveedor, tiene: true, ultimos4: fila.ultimos4, verificada_en: ahora })
})

app.post('/api/ia/clave/probar', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const proveedor = proveedorIa(req.body?.proveedor)
  if (!proveedor) return res.status(400).json({ error: 'Proveedor de IA no válido' })
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) return res.status(400).json({ error: 'No se encontró tu organización' })

  const clave = (await clavesIaDeOrganizacion(miembro.organizacion_id))[proveedor]
  if (!clave) return res.status(404).json({ error: `No hay ninguna clave de ${NOMBRE_PROVEEDOR_IA[proveedor]} guardada` })
  const fallo = await probarClaveIa(proveedor, clave)
  if (fallo) return res.status(fallo.estado).json({ error: fallo.error })

  const ahora = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('organizaciones_claves_ia')
    .update({ verificada_en: ahora })
    .eq('organizacion_id', miembro.organizacion_id).eq('proveedor', proveedor)
    .select('ultimos4').maybeSingle()
  if (error) console.error('[ia/clave] error guardando la fecha de la prueba:', error.message)
  res.json({ proveedor, tiene: true, ultimos4: data?.ultimos4 || null, verificada_en: ahora })
})

app.delete('/api/ia/clave', requireAuth, async (req, res) => {
  const proveedor = proveedorIa(req.query.proveedor)
  const miembro = await miembroAdminParaClaveIa(req, res, proveedor)
  if (!miembro) return

  const { error } = await supabaseAdmin.from('organizaciones_claves_ia').delete()
    .eq('organizacion_id', miembro.organizacion_id).eq('proveedor', proveedor)
  if (error && !esTablaInexistente(error)) {
    console.error('[ia/clave] error borrando la clave:', error.message)
    return res.status(500).json({ error: 'No se pudo quitar la clave. Inténtalo de nuevo.' })
  }
  res.json({ proveedor, tiene: false, ultimos4: null, verificada_en: null })
})

// ── Claves de API para el MCP de Aify (0046_claves_api.sql) ───────────────────
// Claude se conecta al MCP con "Authorization: Bearer aify_...". La clave en
// claro solo existe en la respuesta de POST /api/claves-api: se guarda su
// sha256 y sus últimos 4 caracteres, y nunca se escribe en logs.
// Cualquier miembro puede crear claves (actúan en su nombre); revocar, quien
// la creó o el owner/admin de la organización.

const PREFIJO_CLAVE_API = 'aify_'
const ALFABETO_CLAVE_API = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const MENSAJE_SIN_MIGRACION_CLAVES_API = 'Falta aplicar la migración 0046 para usar las claves de API.'
const esTablaClavesApiInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205' || /claves_api/.test(error.message || ''))
const hashClaveApi = (clave) => crypto.createHash('sha256').update(clave).digest('hex')

// "aify_" + 40 caracteres alfanuméricos. Se descartan los bytes >= 248 (4 × 62)
// para que cada carácter sea equiprobable.
function generarClaveApi() {
  let cuerpo = ''
  while (cuerpo.length < 40) {
    for (const byte of crypto.randomBytes(64)) {
      if (byte < 248 && cuerpo.length < 40) cuerpo += ALFABETO_CLAVE_API[byte % 62]
    }
  }
  return PREFIJO_CLAVE_API + cuerpo
}

const COLUMNAS_CLAVE_API = 'id, nombre, ultimos4, creada_por, creada_en, ultimo_uso_en, revocada_en'

app.get('/api/claves-api', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) return res.status(400).json({ error: 'No se encontró tu organización' })

  const { data, error } = await supabaseAdmin
    .from('claves_api')
    .select(COLUMNAS_CLAVE_API)
    .eq('organizacion_id', miembro.organizacion_id)
    .is('revocada_en', null)
    .order('creada_en', { ascending: false })
  if (esTablaClavesApiInexistente(error)) return res.json({ claves: [], sinMigracion: true })
  if (error) return res.status(500).json({ error: 'No se pudieron cargar las claves de API' })
  res.json({ claves: data || [] })
})

app.post('/api/claves-api', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) return res.status(400).json({ error: 'No se encontró tu organización' })

  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim().slice(0, 80) : ''
  if (!nombre) return res.status(400).json({ error: 'Ponle un nombre a la clave (por ejemplo, «Claude Code del Mac»).' })

  const clave = generarClaveApi()
  const { data, error } = await supabaseAdmin
    .from('claves_api')
    .insert({
      organizacion_id: miembro.organizacion_id,
      creada_por: req.userId,
      nombre,
      hash: hashClaveApi(clave),
      ultimos4: clave.slice(-4),
    })
    .select(COLUMNAS_CLAVE_API)
    .single()
  if (esTablaClavesApiInexistente(error)) return res.status(503).json({ error: MENSAJE_SIN_MIGRACION_CLAVES_API })
  if (error) {
    console.error('[claves-api] error creando la clave:', error.message)
    return res.status(500).json({ error: 'No se pudo crear la clave. Inténtalo de nuevo.' })
  }
  // Única vez que la clave sale del servidor
  res.json({ clave: data, claveEnClaro: clave })
})

app.delete('/api/claves-api/:id', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const miembro = await miembroDeOrganizacion(req.userId)
  if (!miembro) return res.status(400).json({ error: 'No se encontró tu organización' })

  const { data: fila, error } = await supabaseAdmin
    .from('claves_api')
    .select('id, creada_por')
    .eq('id', req.params.id)
    .eq('organizacion_id', miembro.organizacion_id)
    .maybeSingle()
  if (esTablaClavesApiInexistente(error)) return res.status(503).json({ error: MENSAJE_SIN_MIGRACION_CLAVES_API })
  if (error || !fila) return res.status(404).json({ error: 'No se encontró esa clave' })
  if (fila.creada_por !== req.userId && !ROLES_ADMIN_ORGANIZACION.includes(miembro.rol)) {
    return res.status(403).json({ error: 'Solo quien creó la clave o el propietario de la organización puede revocarla' })
  }

  const { error: errorRevocar } = await supabaseAdmin
    .from('claves_api')
    .update({ revocada_en: new Date().toISOString() })
    .eq('id', fila.id)
    .is('revocada_en', null)
  if (errorRevocar) {
    console.error('[claves-api] error revocando la clave:', errorRevocar.message)
    return res.status(500).json({ error: 'No se pudo revocar la clave. Inténtalo de nuevo.' })
  }
  res.json({ ok: true })
})

// Autentica las peticiones del MCP con una clave de API. Deja en req
// organizacionId (todas las consultas del MCP deben filtrar por ella) y
// userId (quien creó la clave). Rechaza claves revocadas y las de usuarios
// que ya no son de la organización.
const INTERVALO_ULTIMO_USO_MS = 60 * 1000

async function requireClaveApi(req, res, next) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Base de datos no disponible en el servidor' })
  const authHeader = req.headers.authorization || ''
  const clave = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!clave.startsWith(PREFIJO_CLAVE_API)) {
    return res.status(401).json({ error: 'Falta la clave de API de Aify (Authorization: Bearer aify_...). Créala en Configuración.' })
  }

  const { data: fila, error } = await supabaseAdmin
    .from('claves_api')
    .select('id, organizacion_id, creada_por, ultimo_uso_en, revocada_en')
    .eq('hash', hashClaveApi(clave))
    .maybeSingle()
  if (esTablaClavesApiInexistente(error)) return res.status(503).json({ error: MENSAJE_SIN_MIGRACION_CLAVES_API })
  if (error) {
    console.error('[requireClaveApi] error buscando la clave:', error.message)
    return res.status(500).json({ error: 'No se pudo comprobar la clave de API' })
  }
  if (!fila || fila.revocada_en) return res.status(401).json({ error: 'Clave de API no válida o revocada. Crea una nueva en Configuración.' })

  const miembro = fila.creada_por ? await miembroDeOrganizacion(fila.creada_por) : null
  if (!miembro || miembro.organizacion_id !== fila.organizacion_id) {
    return res.status(401).json({ error: 'Quien creó esta clave ya no está en la organización. Crea una nueva en Configuración.' })
  }

  req.organizacionId = fila.organizacion_id
  req.userId = fila.creada_por
  req.claveApiId = fila.id

  // ultimo_uso_en como mucho una vez por minuto; si falla, no corta la petición
  if (!fila.ultimo_uso_en || Date.now() - new Date(fila.ultimo_uso_en).getTime() > INTERVALO_ULTIMO_USO_MS) {
    supabaseAdmin.from('claves_api').update({ ultimo_uso_en: new Date().toISOString() }).eq('id', fila.id)
      .then(({ error: errorUso }) => { if (errorUso) console.error('[requireClaveApi] error guardando el último uso:', errorUso.message) })
  }
  next()
}

// ─── Instagram: conexión (Instagram Login) + métricas reales ──────────────────
//
// Flujo "Instagram API with Instagram Login" (graph.instagram.com): la cuenta
// del cliente tiene que ser profesional (Business o Creator), pero NO necesita
// una página de Facebook vinculada. Ver docs/instagram-setup.md.
//
// Los tokens viven en public.instagram_tokens (0027_instagram.sql), que solo
// lee la service role; el navegador solo ve el estado de la conexión y las
// métricas ya calculadas que devuelven estos endpoints.

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3011/api/instagram/callback'
const INSTAGRAM_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || 'v23.0'
// manage_comments + manage_messages: DMs automáticos por palabra clave.
// content_publish: publicar desde el calendario. Las cuentas conectadas antes
// de añadirlos tienen que reconectar (ver instagram_conexiones.permisos).
const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
  'instagram_business_content_publish',
].join(',')
const INSTAGRAM_CACHE_TTL_MS = 60 * 60 * 1000 // las métricas se piden a Meta como mucho una vez por hora
const INSTAGRAM_REFRESCO_MIN_MS = 5 * 60 * 1000 // "Actualizar" a mano, como mucho cada 5 minutos
const INSTAGRAM_STATE_TTL_MS = 15 * 60 * 1000

// Métricas de cuenta (period=day + metric_type=total_value, rango máx. 30 días)
// y de publicación que la Graph API actual sigue ofreciendo. "impressions" y
// "plays" están retiradas; "views" es su reemplazo.
const IG_METRICAS_CUENTA = [
  'reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares',
  'replies', 'profile_links_taps', 'reposts',
]
// Cada tipo de publicación admite métricas distintas: los reels traen la
// retención (tiempo medio visto, % de gente que lo salta) y los posts del feed
// las visitas al perfil y los seguidores que trajeron.
const IG_METRICAS_MEDIA_BASE = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions']
const IG_METRICAS_MEDIA = {
  REEL: [...IG_METRICAS_MEDIA_BASE, 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate', 'reposts'],
  FEED: [...IG_METRICAS_MEDIA_BASE, 'profile_visits', 'follows', 'reposts'],
}
const IG_VIDEO_MAX_BYTES = 80 * 1024 * 1024

function instagramConfigurado() {
  return Boolean(INSTAGRAM_APP_ID && INSTAGRAM_APP_SECRET && supabaseAdmin)
}

class InstagramApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Nunca se loguea la URL (lleva el access_token) — solo el mensaje de Meta.
async function instagramGraphGet(path, params = {}) {
  const url = new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${path.replace(/^\//, '')}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) {
    throw new InstagramApiError(data.error?.message || `Instagram respondió ${response.status}`, {
      status: response.status, code: data.error?.code,
    })
  }
  return data
}

function tokenInvalido(err) {
  return err instanceof InstagramApiError && (err.code === 190 || err.status === 401)
}

// El state del OAuth va firmado (HMAC con el app secret) para que nadie pueda
// fabricar un callback que conecte su Instagram a un cliente ajeno.
function firmarStateInstagram(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const firma = crypto.createHmac('sha256', INSTAGRAM_APP_SECRET).update(cuerpo).digest('base64url')
  return `${cuerpo}.${firma}`
}

function leerStateInstagram(state) {
  const [cuerpo, firma] = String(state || '').split('.')
  if (!cuerpo || !firma || !INSTAGRAM_APP_SECRET) return null
  const esperada = crypto.createHmac('sha256', INSTAGRAM_APP_SECRET).update(cuerpo).digest('base64url')
  const a = Buffer.from(firma)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function instagramRedirectFrontend(clienteId, params) {
  const frontendUrl = FRONTEND_ORIGINS[0] || 'http://localhost:5174'
  const query = new URLSearchParams(params)
  const ruta = clienteId && UUID_RE.test(clienteId) ? `/clientes/${clienteId}` : '/clientes'
  return `${frontendUrl}${ruta}?${query}`
}

// Mismo criterio que las policies de clientes (0006_organizaciones.sql):
// el dueño del cliente o cualquier miembro de su organización.
async function accesoClienteInstagram(clienteId, userId) {
  if (!supabaseAdmin || !clienteId || !UUID_RE.test(clienteId)) return { cliente: null, organizacion: null }
  const [{ data: cliente }, organizacion] = await Promise.all([
    supabaseAdmin.from('clientes').select('id, user_id, organizacion_id').eq('id', clienteId).maybeSingle(),
    obtenerOrganizacionDelUsuario(userId),
  ])
  if (!cliente) return { cliente: null, organizacion }
  const permitido = cliente.user_id === userId || Boolean(organizacion?.id && cliente.organizacion_id === organizacion.id)
  return { cliente: permitido ? cliente : null, organizacion }
}

// Middleware común: sesión (requireAuth va antes) y cliente accesible.
function requireClienteInstagram() {
  return async (req, res, next) => {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Instagram no está disponible en el servidor' })
    const clienteId = req.params.clienteId || req.query.clienteId
    const { cliente } = await accesoClienteInstagram(clienteId, req.userId)
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    req.clienteInstagram = cliente
    next()
  }
}

// Canjea el code del OAuth por un token corto y luego por uno largo (60 días).
async function canjearCodigoInstagram(code) {
  const body = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    code,
  })
  const response = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body })
  const data = await response.json().catch(() => ({}))
  // Según la versión, la respuesta viene plana o dentro de data[0].
  const corto = data.access_token ? data : data.data?.[0]
  if (!response.ok || !corto?.access_token) {
    throw new InstagramApiError(data.error_message || data.error?.message || 'No se pudo canjear el código de Instagram', { status: response.status })
  }

  const largoUrl = new URL('https://graph.instagram.com/access_token')
  largoUrl.searchParams.set('grant_type', 'ig_exchange_token')
  largoUrl.searchParams.set('client_secret', INSTAGRAM_APP_SECRET)
  largoUrl.searchParams.set('access_token', corto.access_token)
  const largoRes = await fetch(largoUrl)
  const largo = await largoRes.json().catch(() => ({}))
  if (!largoRes.ok || !largo.access_token) {
    throw new InstagramApiError(largo.error?.message || 'No se pudo obtener un token de larga duración', { status: largoRes.status })
  }
  const permisos = Array.isArray(corto.permissions) ? corto.permissions : String(corto.permissions || '').split(',').map(p => p.trim()).filter(Boolean)
  return { accessToken: largo.access_token, expiresIn: Number(largo.expires_in) || null, permisos }
}

function expiraEnDesde(expiresIn) {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
}

// Los tokens largos duran 60 días y se pueden renovar si tienen más de 24 h:
// se renuevan solos cuando quedan menos de 15 días, al pedir métricas.
async function tokenInstagramVigente(clienteId) {
  const { data: fila, error } = await supabaseAdmin.from('instagram_tokens')
    .select('access_token, expira_en, actualizado_en').eq('cliente_id', clienteId).maybeSingle()
  if (error) throw new Error('No se pudo leer la conexión de Instagram')
  if (!fila) return null

  const quedaMs = fila.expira_en ? new Date(fila.expira_en).getTime() - Date.now() : Infinity
  const edadMs = Date.now() - new Date(fila.actualizado_en).getTime()
  if (quedaMs < 15 * 24 * 60 * 60 * 1000 && quedaMs > 0 && edadMs > 24 * 60 * 60 * 1000) {
    try {
      const renovado = await instagramGraphGet('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: fila.access_token })
      if (renovado.access_token) {
        const expiraEn = expiraEnDesde(Number(renovado.expires_in) || null)
        await supabaseAdmin.from('instagram_tokens').update({
          access_token: renovado.access_token, expira_en: expiraEn, actualizado_en: new Date().toISOString(),
        }).eq('cliente_id', clienteId)
        await supabaseAdmin.from('instagram_conexiones').update({ token_expira_en: expiraEn }).eq('cliente_id', clienteId)
        return renovado.access_token
      }
    } catch (err) {
      console.error('[instagram] no se pudo renovar el token:', err.message)
    }
  }
  return fila.access_token
}

function valorInsight(item) {
  const value = item?.total_value?.value ?? item?.values?.[0]?.value
  return Number.isFinite(Number(value)) ? Number(value) : null
}

// Pide varias métricas de una vez; si Meta rechaza el lote (una métrica no
// existe para ese tipo de contenido o esa cuenta), las pide de una en una y
// se queda con las que sí responden. Si el token no vale, eso sí se propaga.
// alAprender(validas) recibe las que sí respondieron, para no repetir el uno a
// uno con cada publicación del mismo tipo.
async function pedirInsights(path, metricas, params, alAprender) {
  const aObjeto = (data) => Object.fromEntries((data?.data || []).map(item => [item.name, valorInsight(item)]))
  try {
    return aObjeto(await instagramGraphGet(path, { ...params, metric: metricas.join(',') }))
  } catch (err) {
    if (tokenInvalido(err)) throw err
    const resultado = {}
    const validas = []
    for (const metrica of metricas) {
      try {
        Object.assign(resultado, aObjeto(await instagramGraphGet(path, { ...params, metric: metrica })))
        validas.push(metrica)
      } catch (errMetrica) {
        if (tokenInvalido(errMetrica)) throw errMetrica
      }
    }
    if (validas.length) alAprender?.(validas)
    return resultado
  }
}

// Métrica con desglose (follow_type, city, age, gender…) → [{ clave, valor }],
// o null si Meta no la da (por ejemplo, cuentas con menos de 100 seguidores).
async function pedirDesglose(path, metrica, breakdown, params) {
  try {
    const data = await instagramGraphGet(path, { ...params, metric: metrica, breakdown })
    const resultados = data?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []
    return resultados
      .map(r => ({ clave: r.dimension_values?.[0] ?? null, valor: Number(r.value) || 0 }))
      .filter(r => r.clave)
  } catch (err) {
    if (tokenInvalido(err)) throw err
    return null
  }
}

// Serie diaria de una métrica de cuenta → [{ dia: 'YYYY-MM-DD', valor }] o null
async function pedirSerieDiaria(path, metrica, params) {
  try {
    const data = await instagramGraphGet(path, { ...params, metric: metrica, period: 'day' })
    return (data?.data?.[0]?.values || [])
      .map(v => ({ dia: String(v.end_time || '').slice(0, 10), valor: Number(v.value) || 0 }))
      .filter(v => v.dia)
  } catch (err) {
    if (tokenInvalido(err)) throw err
    return null
  }
}

async function enLotes(items, tamaño, fn) {
  const resultados = []
  for (let i = 0; i < items.length; i += tamaño) {
    resultados.push(...await Promise.all(items.slice(i, i + tamaño).map(fn)))
  }
  return resultados
}

async function obtenerMetricasInstagram(accessToken) {
  const perfil = await instagramGraphGet('me', {
    fields: 'user_id,username,name,account_type,followers_count,media_count,profile_picture_url',
    access_token: accessToken,
  })
  const igUserId = perfil.user_id || perfil.id

  // Últimos 30 días: la API no admite rangos de más de 30 días, así que se
  // arranca a medianoche (UTC) de hace 29 días y se llega hasta ahora.
  const hasta = Math.floor(Date.now() / 1000)
  const inicio = new Date()
  inicio.setUTCHours(0, 0, 0, 0)
  const desde = Math.floor(inicio.getTime() / 1000) - 29 * 24 * 60 * 60
  const rango = { since: desde, until: hasta, access_token: accessToken }
  const totales = { period: 'day', metric_type: 'total_value', ...rango }
  const cuenta = await pedirInsights(`${igUserId}/insights`, IG_METRICAS_CUENTA, totales)

  // Extras de cuenta: seguidores ganados/perdidos, evolución diaria y
  // audiencia. Meta solo da algunos a cuentas con 100+ seguidores; si no, null.
  const lifetime = { period: 'lifetime', metric_type: 'total_value', timeframe: 'this_month', access_token: accessToken }
  const [seguimientos, serieAlcance, serieSeguidores, ciudades, edades, generos] = await Promise.all([
    pedirDesglose(`${igUserId}/insights`, 'follows_and_unfollows', 'follow_type', totales),
    pedirSerieDiaria(`${igUserId}/insights`, 'reach', rango),
    // follower_count solo existe hasta ayer: se corta a medianoche de hoy
    pedirSerieDiaria(`${igUserId}/insights`, 'follower_count', { ...rango, until: Math.floor(inicio.getTime() / 1000) }),
    pedirDesglose(`${igUserId}/insights`, 'follower_demographics', 'city', lifetime),
    pedirDesglose(`${igUserId}/insights`, 'follower_demographics', 'age', lifetime),
    pedirDesglose(`${igUserId}/insights`, 'follower_demographics', 'gender', lifetime),
  ])
  const seguimiento = (tipo) => seguimientos?.find(r => r.clave === tipo)?.valor ?? null
  const top = (lista, n) => lista ? [...lista].sort((a, b) => b.valor - a.valor).slice(0, n) : null

  // Publicaciones: desde el día 1 del mes pasado (el frontend filtra el mes en
  // curso y, si no hay nada, enseña las más recientes). Tope de 3 páginas.
  const ahora = new Date()
  const corte = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1)).getTime()
  const media = []
  let after
  for (let pagina = 0; pagina < 3; pagina++) {
    const res = await instagramGraphGet(`${igUserId}/media`, {
      fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count',
      limit: 50, after, access_token: accessToken,
    })
    media.push(...(res.data || []))
    const ultimo = res.data?.[res.data.length - 1]
    after = res.paging?.cursors?.after
    if (!res.paging?.next || !after || !ultimo || new Date(ultimo.timestamp).getTime() < corte) break
  }
  const recientes = media.filter(m => new Date(m.timestamp).getTime() >= corte)
  const seleccion = recientes.length > 0 ? recientes : media.slice(0, 12)

  const metricasPorTipo = { ...IG_METRICAS_MEDIA }
  const publicaciones = await enLotes(seleccion, 5, async (m) => {
    const grupo = m.media_product_type === 'REELS' ? 'REEL' : 'FEED'
    const insights = await pedirInsights(`${m.id}/insights`, metricasPorTipo[grupo], { access_token: accessToken },
      (validas) => { metricasPorTipo[grupo] = validas })
    return {
      id: m.id,
      fecha: m.timestamp,
      tipo: m.media_product_type === 'REELS' ? 'REEL' : m.media_type,
      texto: (m.caption || '').slice(0, 160),
      enlace: m.permalink || null,
      miniatura: m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url) || null,
      alcance: insights.reach ?? null,
      visualizaciones: insights.views ?? null,
      meGusta: insights.likes ?? m.like_count ?? null,
      comentarios: insights.comments ?? m.comments_count ?? null,
      guardados: insights.saved ?? null,
      compartidos: insights.shares ?? null,
      interacciones: insights.total_interactions ?? null,
      reposts: insights.reposts ?? null,
      // Solo reels: milisegundos y porcentaje (0-100)
      vistoMedioMs: insights.ig_reels_avg_watch_time ?? null,
      vistoTotalMs: insights.ig_reels_video_view_total_time ?? null,
      saltos: insights.reels_skip_rate ?? null,
      // Solo feed
      visitasPerfil: insights.profile_visits ?? null,
      seguidoresGanados: insights.follows ?? null,
      esVideo: m.media_type === 'VIDEO',
    }
  })

  return {
    perfil: {
      igUserId,
      usuario: perfil.username || null,
      nombre: perfil.name || null,
      tipoCuenta: perfil.account_type || null,
      seguidores: perfil.followers_count ?? null,
      publicaciones: perfil.media_count ?? null,
      foto: perfil.profile_picture_url || null,
    },
    cuenta: {
      desde: new Date(desde * 1000).toISOString(),
      hasta: new Date(hasta * 1000).toISOString(),
      alcance: cuenta.reach ?? null,
      visualizaciones: cuenta.views ?? null,
      cuentasInteraccion: cuenta.accounts_engaged ?? null,
      interacciones: cuenta.total_interactions ?? null,
      meGusta: cuenta.likes ?? null,
      comentarios: cuenta.comments ?? null,
      guardados: cuenta.saves ?? null,
      compartidos: cuenta.shares ?? null,
      respuestas: cuenta.replies ?? null,
      toquesEnlaces: cuenta.profile_links_taps ?? null,
      reposts: cuenta.reposts ?? null,
      nuevosSeguidores: seguimiento('FOLLOWER'),
      dejaronDeSeguir: seguimiento('NON_FOLLOWER'),
    },
    series: {
      alcance: serieAlcance,
      nuevosSeguidores: serieSeguidores,
    },
    audiencia: {
      ciudades: top(ciudades, 6),
      edades: edades ? [...edades].sort((a, b) => a.clave.localeCompare(b.clave)) : null,
      generos,
    },
    publicaciones,
  }
}

async function marcarConexionInstagram(clienteId, campos) {
  const { error } = await supabaseAdmin.from('instagram_conexiones').update(campos).eq('cliente_id', clienteId)
  if (error) console.error('[instagram] error actualizando la conexión:', error.message)
}

// 1) Devuelve la URL de autorización de Instagram para este cliente.
app.get('/api/instagram/conectar', requireAuth, requireClienteInstagram(), (req, res) => {
  if (!instagramConfigurado()) {
    return res.status(503).json({ error: 'La conexión con Instagram todavía no está configurada', codigo: 'no_configurado' })
  }
  const state = firmarStateInstagram({ c: req.clienteInstagram.id, u: req.userId, exp: Date.now() + INSTAGRAM_STATE_TTL_MS })
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', INSTAGRAM_APP_ID)
  url.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_SCOPES)
  url.searchParams.set('state', state)
  res.json({ url: url.toString() })
})

// 2) Instagram vuelve aquí tras autorizar (sin cabecera de sesión: la
// identidad viaja en el state firmado). Redirige siempre al frontend.
app.get('/api/instagram/callback', async (req, res) => {
  const payload = leerStateInstagram(req.query.state)
  const clienteId = payload?.c
  const volver = (params) => res.redirect(instagramRedirectFrontend(clienteId, params))

  if (req.query.error) return volver({ instagram: 'error', motivo: req.query.error === 'access_denied' ? 'cancelado' : 'error' })
  if (!payload) return volver({ instagram: 'error', motivo: 'enlace_caducado' })
  if (!instagramConfigurado()) return volver({ instagram: 'error', motivo: 'no_configurado' })
  const code = String(req.query.code || '').replace(/#_$/, '')
  if (!code) return volver({ instagram: 'error', motivo: 'error' })

  try {
    const { cliente } = await accesoClienteInstagram(clienteId, payload.u)
    if (!cliente) return volver({ instagram: 'error', motivo: 'cliente' })

    const { accessToken, expiresIn, permisos } = await canjearCodigoInstagram(code)
    const perfil = await instagramGraphGet('me', { fields: 'user_id,username,account_type', access_token: accessToken })
    const expiraEn = expiraEnDesde(expiresIn)
    const ahora = new Date().toISOString()

    const conexion = {
      cliente_id: clienteId,
      ig_user_id: String(perfil.user_id || perfil.id),
      ig_username: perfil.username || null,
      tipo_cuenta: perfil.account_type || null,
      conectado_por: payload.u,
      conectado_en: ahora,
      token_expira_en: expiraEn,
      estado: 'activa',
      ultimo_error: null,
      permisos,
    }
    let { error: errorConexion } = await supabaseAdmin.from('instagram_conexiones').upsert(conexion, { onConflict: 'cliente_id' })
    // Sin la migración 0036 la columna permisos no existe: se guarda sin ella
    // para no romper la conexión de métricas.
    if (errorConexion && /permisos/.test(errorConexion.message || '')) {
      delete conexion.permisos
      ;({ error: errorConexion } = await supabaseAdmin.from('instagram_conexiones').upsert(conexion, { onConflict: 'cliente_id' }))
    }
    if (errorConexion) throw errorConexion
    const { error: errorToken } = await supabaseAdmin.from('instagram_tokens').upsert({
      cliente_id: clienteId, access_token: accessToken, expira_en: expiraEn, actualizado_en: ahora,
    }, { onConflict: 'cliente_id' })
    if (errorToken) throw errorToken
    // Una cuenta nueva invalida la caché de la anterior.
    await supabaseAdmin.from('instagram_metricas_cache').delete().eq('cliente_id', clienteId)
    // Para recibir los comentarios por webhook (DMs automáticos).
    if (permisos.includes('instagram_business_manage_comments')) await suscribirWebhookInstagram(accessToken)

    volver({ instagram: 'conectado' })
  } catch (err) {
    console.error('[instagram] error en el callback:', err.message)
    volver({ instagram: 'error', motivo: 'error' })
  }
})

// 3) Estado de la conexión (sin tokens).
app.get('/api/instagram/estado/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('instagram_conexiones')
    .select('*')
    .eq('cliente_id', req.clienteInstagram.id).maybeSingle()
  if (error) return res.status(500).json({ error: 'No se pudo consultar la conexión de Instagram' })
  res.json({
    configurado: instagramConfigurado(),
    conectado: data?.estado === 'activa',
    conexion: data ? {
      ig_username: data.ig_username,
      tipo_cuenta: data.tipo_cuenta,
      conectado_en: data.conectado_en,
      token_expira_en: data.token_expira_en,
      estado: data.estado,
      ultimo_error: data.ultimo_error,
      permisos: data.permisos || null,
    } : null,
  })
})

// 4) Métricas: caché de 1 h en instagram_metricas_cache; ?refrescar=1 fuerza
// una lectura nueva (como mucho cada 5 minutos).
app.get('/api/instagram/metricas/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  if (!instagramConfigurado()) {
    return res.status(503).json({ error: 'La conexión con Instagram todavía no está configurada', codigo: 'no_configurado' })
  }
  const clienteId = req.clienteInstagram.id
  const refrescar = req.query.refrescar === '1'

  const { data: cache } = await supabaseAdmin.from('instagram_metricas_cache')
    .select('datos, actualizado_en').eq('cliente_id', clienteId).maybeSingle()
  const edadMs = cache ? Date.now() - new Date(cache.actualizado_en).getTime() : Infinity
  if (cache && (edadMs < INSTAGRAM_REFRESCO_MIN_MS || (!refrescar && edadMs < INSTAGRAM_CACHE_TTL_MS))) {
    return res.json({ ...cache.datos, actualizadoEn: cache.actualizado_en, desdeCache: true })
  }

  let accessToken
  try {
    accessToken = await tokenInstagramVigente(clienteId)
  } catch (err) {
    console.error('[instagram] error leyendo el token:', err.message)
    return res.status(500).json({ error: 'No se pudo leer la conexión de Instagram' })
  }
  if (!accessToken) return res.status(409).json({ error: 'Este cliente no tiene Instagram conectado', codigo: 'no_conectado' })

  try {
    const datos = await obtenerMetricasInstagram(accessToken)
    const actualizadoEn = new Date().toISOString()
    const { error } = await supabaseAdmin.from('instagram_metricas_cache')
      .upsert({ cliente_id: clienteId, datos, actualizado_en: actualizadoEn }, { onConflict: 'cliente_id' })
    if (error) console.error('[instagram] error guardando la caché de métricas:', error.message)
    await marcarConexionInstagram(clienteId, {
      estado: 'activa',
      ultimo_error: null,
      ...(datos.perfil.usuario ? { ig_username: datos.perfil.usuario } : {}),
    })
    res.json({ ...datos, actualizadoEn, desdeCache: false })
  } catch (err) {
    console.error('[instagram] error pidiendo métricas:', err.message)
    if (tokenInvalido(err)) {
      await marcarConexionInstagram(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
      return res.status(409).json({ error: 'El permiso de Instagram caducó o se revocó. Vuelve a conectar la cuenta.', codigo: 'reconectar' })
    }
    await marcarConexionInstagram(clienteId, { ultimo_error: 'Instagram no respondió al pedir las métricas' })
    // Si Meta falla pero hay una caché antigua, mejor eso que nada.
    if (cache) return res.json({ ...cache.datos, actualizadoEn: cache.actualizado_en, desdeCache: true, aviso: 'Instagram no respondió; se muestran los últimos datos guardados.' })
    res.status(502).json({ error: 'Instagram no respondió al pedir las métricas. Inténtalo de nuevo en unos minutos.' })
  }
})

// 4b) Visualizaciones por mes de todas las cuentas conectadas (tarjeta del
// Inicio). Meta solo da rangos de 30 días, así que cada mes se pide en dos
// tramos y se guarda en instagram_visitas_mes: los meses cerrados una vez, el
// mes en curso como mucho cada hora. views es una suma, así que los tramos se
// pueden sumar (el alcance no, por eso no se usa). Se suman también las de
// TikTok, que salen de las fotos diarias de tiktok_metricas_dia (0050).
const VISITAS_MESES = 6

function mesesVisitas(ahora = new Date()) {
  return Array.from({ length: VISITAS_MESES }, (_, i) => {
    const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - (VISITAS_MESES - 1 - i), 1))
    const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1))
    return { mes: inicio.toISOString().slice(0, 10), inicio, fin, enCurso: fin > ahora }
  })
}

async function visualizacionesDelMes(igUserId, accessToken, { inicio, fin }) {
  const hasta = Math.min(fin.getTime(), Date.now())
  const mitad = Math.min(inicio.getTime() + 15 * 24 * 60 * 60 * 1000, hasta)
  const tramos = [[inicio.getTime(), mitad], [mitad, hasta]].filter(([a, b]) => b > a)
  let total = 0
  for (const [desde, hastaTramo] of tramos) {
    const datos = await pedirInsights(`${igUserId}/insights`, ['views'], {
      period: 'day', metric_type: 'total_value',
      since: Math.floor(desde / 1000), until: Math.floor(hastaTramo / 1000), access_token: accessToken,
    })
    if (datos?.views == null) return null
    total += Number(datos.views) || 0
  }
  return total
}

// Instagram: { cuentas, valores: { 'YYYY-MM-01': total | null } } de las
// cuentas activas de esos clientes.
async function visitasMensualesInstagram(ids, meses) {
  const { data: conexiones } = ids.length
    ? await supabaseAdmin.from('instagram_conexiones').select('cliente_id, ig_user_id, ig_username').in('cliente_id', ids).eq('estado', 'activa')
    : { data: [] }

  const { data: guardadas } = (conexiones || []).length
    ? await supabaseAdmin.from('instagram_visitas_mes').select('cliente_id, mes, visualizaciones, actualizado_en')
      .in('cliente_id', conexiones.map(c => c.cliente_id)).gte('mes', meses[0].mes)
    : { data: [] }
  const guardada = (clienteId, mes) => (guardadas || []).find(g => g.cliente_id === clienteId && g.mes === mes.mes)
  // Un mes cerrado vale si se guardó después de cerrarse; el en curso, si tiene
  // menos de 1 h. Sin dato (Meta no lo dio: mes muy antiguo o fallo puntual),
  // se reintenta al día siguiente.
  const edad = (g) => Date.now() - new Date(g.actualizado_en).getTime()
  const vigente = (g, mes) => {
    if (!g) return false
    if (g.visualizaciones == null) return edad(g) < 24 * 60 * 60 * 1000
    return mes.enCurso ? edad(g) < INSTAGRAM_CACHE_TTL_MS : new Date(g.actualizado_en) >= mes.fin
  }

  const porCliente = await enLotes(conexiones || [], 3, async (conexion) => {
    const valores = {}
    const faltan = meses.filter(m => {
      const g = guardada(conexion.cliente_id, m)
      if (g) valores[m.mes] = g.visualizaciones
      return !vigente(g, m)
    })
    if (faltan.length === 0) return valores
    let accessToken
    try {
      accessToken = await tokenInstagramVigente(conexion.cliente_id)
    } catch {
      return valores
    }
    if (!accessToken) return valores
    const filas = []
    for (const mes of faltan) {
      try {
        const total = await visualizacionesDelMes(conexion.ig_user_id, accessToken, mes)
        valores[mes.mes] = total
        filas.push({ cliente_id: conexion.cliente_id, mes: mes.mes, visualizaciones: total, actualizado_en: new Date().toISOString() })
      } catch (err) {
        // Token caducado o Meta caído: se enseña lo guardado y se sigue con el resto.
        console.error('[instagram] visitas por mes:', err.message)
        break
      }
    }
    if (filas.length) {
      const { error } = await supabaseAdmin.from('instagram_visitas_mes').upsert(filas, { onConflict: 'cliente_id,mes' })
      if (error) console.error('[instagram] error guardando visitas por mes:', error.message)
    }
    return valores
  })

  return {
    cuentas: (conexiones || []).length,
    valores: Object.fromEntries(meses.map(m => {
      const lista = porCliente.map(v => v[m.mes]).filter(v => v != null)
      return [m.mes, lista.length ? lista.reduce((a, b) => a + Number(b), 0) : null]
    })),
  }
}

// Suma de Instagram y TikTok (visitasMensualesTikTok, más abajo). Cada mes
// trae el total y el de cada red; null = sin dato (no 0).
app.get('/api/instagram/visitas-mensuales', requireAuth, async (req, res) => {
  const conInstagram = instagramConfigurado()
  const conTikTok = tiktokConfigurado()
  if (!supabaseAdmin || (!conInstagram && !conTikTok)) return res.json({ configurado: false, meses: [], cuentas: 0 })
  const organizacion = await obtenerOrganizacionDelUsuario(req.userId)

  let consulta = supabaseAdmin.from('clientes').select('id').eq('archivado', false)
  consulta = organizacion?.id
    ? consulta.or(`user_id.eq.${req.userId},organizacion_id.eq.${organizacion.id}`)
    : consulta.eq('user_id', req.userId)
  const { data: clientes, error: errorClientes } = await consulta
  if (errorClientes) return res.status(500).json({ error: 'No se pudieron leer los clientes' })
  const ids = (clientes || []).map(c => c.id)

  const meses = mesesVisitas()
  const sinDatos = { cuentas: 0, valores: {} }
  const [instagram, tiktok] = await Promise.all([
    conInstagram ? visitasMensualesInstagram(ids, meses) : sinDatos,
    conTikTok ? visitasMensualesTikTok(ids, meses).catch(err => { console.error('[tiktok] visitas por mes:', err.message); return sinDatos }) : sinDatos,
  ])

  res.json({
    configurado: true,
    cuentas: instagram.cuentas + tiktok.cuentas,
    cuentasInstagram: instagram.cuentas,
    cuentasTikTok: tiktok.cuentas,
    meses: meses.map(m => {
      const ig = instagram.valores[m.mes] ?? null
      const tt = tiktok.valores[m.mes] ?? null
      return { mes: m.mes, visualizaciones: ig == null && tt == null ? null : (ig || 0) + (tt || 0), instagram: ig, tiktok: tt }
    }),
  })
})

// 5) Desconectar: borra token, conexión y caché del cliente.
app.delete('/api/instagram/conexion/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const clienteId = req.clienteInstagram.id
  const resultados = await Promise.all([
    supabaseAdmin.from('instagram_tokens').delete().eq('cliente_id', clienteId),
    supabaseAdmin.from('instagram_metricas_cache').delete().eq('cliente_id', clienteId),
    supabaseAdmin.from('instagram_visitas_mes').delete().eq('cliente_id', clienteId),
    supabaseAdmin.from('instagram_conexiones').delete().eq('cliente_id', clienteId),
  ])
  if (resultados.some(r => r.error)) return res.status(500).json({ error: 'No se pudo desconectar Instagram' })
  // Los DMs de la bandeja se van con la cuenta (los mensajes caen en cascada).
  await supabaseAdmin.from('instagram_dm_conversaciones').delete().eq('cliente_id', clienteId)
  res.json({ ok: true })
})

// 6) Callbacks que Meta exige para la revisión de la app: "desautorizar" y
// "solicitud de eliminación de datos". Ambos llegan con un signed_request
// firmado con el app secret; se borran los datos de esa cuenta de Instagram.
function leerSignedRequestInstagram(signedRequest) {
  const [firma, cuerpo] = String(signedRequest || '').split('.')
  if (!firma || !cuerpo || !INSTAGRAM_APP_SECRET) return null
  const esperada = crypto.createHmac('sha256', INSTAGRAM_APP_SECRET).update(cuerpo).digest('base64url')
  const a = Buffer.from(firma.replace(/=+$/, ''))
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function borrarDatosCuentaInstagram(igUserId) {
  const { data: conexiones } = await supabaseAdmin.from('instagram_conexiones').select('cliente_id').eq('ig_user_id', String(igUserId))
  const clientes = (conexiones || []).map(c => c.cliente_id)
  if (clientes.length === 0) return
  await supabaseAdmin.from('instagram_tokens').delete().in('cliente_id', clientes)
  await supabaseAdmin.from('instagram_metricas_cache').delete().in('cliente_id', clientes)
  await supabaseAdmin.from('instagram_visitas_mes').delete().in('cliente_id', clientes)
  await supabaseAdmin.from('instagram_dm_conversaciones').delete().in('cliente_id', clientes)
  await supabaseAdmin.from('instagram_conexiones').delete().in('cliente_id', clientes)
}

app.post('/api/instagram/desautorizar', express.urlencoded({ extended: false }), async (req, res) => {
  const datos = leerSignedRequestInstagram(req.body?.signed_request)
  if (!datos?.user_id || !supabaseAdmin) return res.status(400).json({ error: 'Solicitud no válida' })
  await borrarDatosCuentaInstagram(datos.user_id)
  res.json({ ok: true })
})

app.post('/api/instagram/eliminar-datos', express.urlencoded({ extended: false }), async (req, res) => {
  const datos = leerSignedRequestInstagram(req.body?.signed_request)
  if (!datos?.user_id || !supabaseAdmin) return res.status(400).json({ error: 'Solicitud no válida' })
  await borrarDatosCuentaInstagram(datos.user_id)
  const codigo = crypto.randomBytes(8).toString('hex')
  const frontendUrl = FRONTEND_ORIGINS[0] || 'http://localhost:5174'
  res.json({ url: `${frontendUrl}/privacidad`, confirmation_code: codigo })
})

// ─── Instagram: DMs automáticos por palabra clave ────────────────────────────
//
// "Comenta GUIA y te lo mando por DM". Meta avisa de cada comentario nuevo en
// /api/instagram/webhook (campo "comments") y el servidor contesta con una
// respuesta privada (POST /<IG_ID>/messages con recipient.comment_id).
// Reglas de Meta: un solo mensaje por comentario y en los 7 días siguientes.
// Los webhooks solo llegan con la app en modo Live y acceso avanzado (ver
// docs/instagram-setup.md). Tablas en 0036_instagram_dm_publicar.sql.

const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
// Con Instagram Login Meta firma con el secreto de la app de Instagram; si
// la app de Meta tiene otro, se acepta también META_APP_SECRET.
const SECRETOS_WEBHOOK_INSTAGRAM = [INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(Boolean)
const PERMISOS_DM = ['instagram_business_manage_comments', 'instagram_business_manage_messages']
const PERMISO_PUBLICAR = 'instagram_business_content_publish'
const DM_MAX_MENSAJE = 1000
const DM_MAX_RESPUESTA = 300
const DM_MAX_PALABRA = 40
const DM_DISPARADORES = ['comentario', 'dm', 'ambos']

async function instagramGraphPost(path, params, accessToken, { json = false } = {}) {
  const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${path.replace(/^\//, '')}`
  const limpios = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(limpios) : new URLSearchParams(Object.entries(limpios).map(([k, v]) => [k, String(v)])),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) {
    throw new InstagramApiError(data.error?.error_user_msg || data.error?.message || `Instagram respondió ${response.status}`, {
      status: response.status, code: data.error?.code,
    })
  }
  return data
}

async function suscribirWebhookInstagram(accessToken) {
  try {
    await instagramGraphPost('me/subscribed_apps', { subscribed_fields: 'comments,messages' }, accessToken)
    return true
  } catch (err) {
    console.error('[instagram] no se pudo suscribir la cuenta al webhook:', err.message)
    return false
  }
}

function tienePermisos(conexion, permisos) {
  // Conexiones anteriores a 0036 no guardan permisos: no se sabe, se pide reconectar.
  return Array.isArray(conexion?.permisos) && permisos.every(p => conexion.permisos.includes(p))
}

async function conexionInstagram(clienteId) {
  const { data } = await supabaseAdmin.from('instagram_conexiones').select('*').eq('cliente_id', clienteId).maybeSingle()
  return data || null
}

// "¡Guía!" coincide con la palabra clave "guia": minúsculas, sin tildes ni
// signos, y la palabra (o frase) tiene que aparecer entera.
function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function comentarioCoincide(texto, palabraClave) {
  const clave = normalizarTexto(palabraClave)
  return Boolean(clave) && ` ${normalizarTexto(texto)} `.includes(` ${clave} `)
}

function firmaWebhookValida(req) {
  const cabecera = String(req.headers['x-hub-signature-256'] || '')
  if (!cabecera.startsWith('sha256=') || !req.rawBody) return false
  const recibida = Buffer.from(cabecera.slice(7))
  return SECRETOS_WEBHOOK_INSTAGRAM.some(secreto => {
    const esperada = Buffer.from(crypto.createHmac('sha256', secreto).update(req.rawBody).digest('hex'))
    return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada)
  })
}

async function procesarComentarioInstagram(igUserId, valor) {
  const commentId = valor?.id
  const fromId = valor?.from?.id
  // Los comentarios de la propia cuenta (incluida nuestra respuesta pública) no cuentan.
  if (!commentId || !fromId) return console.log('[instagram] comentario sin id o sin autor; se ignora')
  if (String(fromId) === String(igUserId)) return console.log('[instagram] comentario de la propia cuenta; se ignora')
  const mediaId = valor.media?.id || null

  const { data: conexiones } = await supabaseAdmin.from('instagram_conexiones')
    .select('cliente_id').eq('ig_user_id', String(igUserId)).eq('estado', 'activa')
  if (!conexiones?.length) console.log(`[instagram] comentario para la cuenta ${igUserId}, que no está conectada a ningún cliente`)
  for (const { cliente_id: clienteId } of conexiones || []) {
    const { data: reglas } = await supabaseAdmin.from('instagram_dm_reglas')
      .select('*').eq('cliente_id', clienteId).eq('activa', true)
    // Una regla de ese reel concreto manda sobre una regla general.
    const candidatas = (reglas || [])
      .filter(r => (r.disparador || 'comentario') !== 'dm')
      .filter(r => !r.media_id || r.media_id === mediaId)
      .sort((a, b) => Number(Boolean(b.media_id)) - Number(Boolean(a.media_id)))
    const regla = candidatas.find(r => comentarioCoincide(valor.text, r.palabra_clave))
    if (!regla) {
      console.log(`[instagram] comentario ${commentId}: ninguna regla coincide (${candidatas.length} reglas activas)`)
      continue
    }

    // comment_id es único: si Meta reintenta el webhook, el insert falla y no se repite el DM.
    const { data: envio, error: errorEnvio } = await supabaseAdmin.from('instagram_dm_envios').insert({
      cliente_id: clienteId,
      regla_id: regla.id,
      comment_id: String(commentId),
      media_id: mediaId,
      ig_from_id: String(fromId),
      ig_from_username: valor.from?.username || null,
      texto_comentario: String(valor.text || '').slice(0, 500),
    }).select('id').single()
    if (errorEnvio) return
    const marcar = (campos) => supabaseAdmin.from('instagram_dm_envios').update(campos).eq('id', envio.id)

    const { count: yaEnviados } = await supabaseAdmin.from('instagram_dm_envios')
      .select('id', { count: 'exact', head: true })
      .eq('regla_id', regla.id).eq('ig_from_id', String(fromId)).eq('estado', 'enviado')
    if (yaEnviados > 0) return marcar({ estado: 'omitido', error: 'Ya había recibido este mensaje' })

    try {
      const accessToken = await tokenInstagramVigente(clienteId)
      if (!accessToken) return marcar({ estado: 'error', error: 'Instagram no está conectado' })
      const enviado = await instagramGraphPost(`${igUserId}/messages`, {
        recipient: { comment_id: String(commentId) },
        message: { text: regla.mensaje },
      }, accessToken, { json: true })
      await marcar({ estado: 'enviado', error: null })
      // Se apunta ya en la bandeja; el eco que manda Meta después se descarta.
      if (enviado.recipient_id && enviado.message_id) {
        await guardarMensajeDm({
          clienteId, igUserId, contactoId: enviado.recipient_id, mid: enviado.message_id,
          direccion: 'saliente', texto: regla.mensaje, origen: 'automatico',
          contactoUsername: valor.from?.username || null,
        }).catch(err => console.error('[instagram] no se pudo guardar el DM en la bandeja:', err.message))
      }
      if (regla.respuesta_publica) {
        await instagramGraphPost(`${commentId}/replies`, { message: regla.respuesta_publica }, accessToken)
          .catch(err => console.error('[instagram] no se pudo responder en público:', err.message))
      }
    } catch (err) {
      console.error('[instagram] error enviando el DM automático:', err.message)
      await marcar({ estado: 'error', error: String(err.message).slice(0, 300) })
      if (tokenInvalido(err)) {
        await marcarConexionInstagram(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
      }
    }
    return // un comentario, un solo DM
  }
}

// ─── Instagram: bandeja de DMs de todos los clientes ─────────────────────────
//
// Cada DM llega al webhook en entry[].messaging[]: los del contacto y el "eco"
// de lo que manda la cuenta (desde la app de Instagram o desde aquí). Se
// guardan en instagram_dm_conversaciones/mensajes (0039) y la bandeja
// (/instagram/bandeja) los junta de todos los clientes. Meta solo deja
// responder en las 24 h siguientes al último mensaje del contacto.

const DM_VENTANA_MS = 24 * 60 * 60 * 1000
const DM_MAX_TEXTO_BANDEJA = 1000
const DM_SINCRONIZAR_CONVERSACIONES = 20
const NOMBRES_ADJUNTO = {
  image: 'Foto', video: 'Vídeo', audio: 'Audio', file: 'Archivo', share: 'Publicación compartida',
  ig_reel: 'Reel compartido', reel: 'Reel compartido', story_mention: 'Te mencionó en su historia',
  ig_story: 'Respuesta a historia', animated_image: 'GIF', sticker: 'Sticker',
}

function adjuntosMensaje(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 10).map(a => ({
    tipo: a.type || (a.video_data ? 'video' : a.image_data ? 'image' : 'file'),
    url: a.payload?.url || a.image_data?.url || a.video_data?.url || a.file_url || null,
  }))
}

function resumenMensaje(texto, adjuntos) {
  if (texto) return String(texto).slice(0, 200)
  if (adjuntos?.length) return NOMBRES_ADJUNTO[adjuntos[0].tipo] || 'Archivo'
  return ''
}

// Guarda un mensaje (y crea la conversación si hace falta). Devuelve
// { conversacion, duplicado }: duplicado = ya estaba (reintento o eco).
async function guardarMensajeDm({
  clienteId, igUserId, contactoId, mid, direccion, texto = null, adjuntos = [],
  origen = 'instagram', enviadoPor = null, fecha = null, contactoUsername = null,
}) {
  const creadoEn = fecha ? new Date(fecha).toISOString() : new Date().toISOString()
  await supabaseAdmin.from('instagram_dm_conversaciones').upsert(
    { cliente_id: clienteId, ig_user_id: String(igUserId), contacto_id: String(contactoId) },
    { onConflict: 'cliente_id,contacto_id', ignoreDuplicates: true },
  )
  const { data: conversacion, error } = await supabaseAdmin.from('instagram_dm_conversaciones')
    .select('*').eq('cliente_id', clienteId).eq('contacto_id', String(contactoId)).maybeSingle()
  if (error || !conversacion) throw new Error(error?.message || 'No se pudo crear la conversación')

  const { error: errorMensaje } = await supabaseAdmin.from('instagram_dm_mensajes').insert({
    conversacion_id: conversacion.id, cliente_id: clienteId, mid: String(mid), direccion,
    texto: texto ? String(texto).slice(0, 4000) : null, adjuntos, origen, enviado_por: enviadoPor, creado_en: creadoEn,
  })
  if (errorMensaje) {
    if (errorMensaje.code !== '23505') throw new Error(errorMensaje.message)
    // Si el eco llegó antes que nuestro propio insert, se corrige quién lo mandó.
    if (origen !== 'instagram') {
      await supabaseAdmin.from('instagram_dm_mensajes').update({ origen, enviado_por: enviadoPor })
        .eq('cliente_id', clienteId).eq('mid', String(mid))
    }
    return { conversacion, duplicado: true }
  }

  const despues = (iso) => !iso || creadoEn > new Date(iso).toISOString()
  const campos = { actualizado_en: new Date().toISOString() }
  if (!conversacion.ultimo_mensaje_en || creadoEn >= new Date(conversacion.ultimo_mensaje_en).toISOString()) {
    campos.ultimo_mensaje = resumenMensaje(texto, adjuntos)
    campos.ultimo_mensaje_en = creadoEn
  }
  if (direccion === 'entrante' && despues(conversacion.ultimo_entrante_en)) campos.ultimo_entrante_en = creadoEn
  // Contestar cuenta como leer: lo que escribió antes ya no está pendiente.
  if (direccion === 'saliente' && despues(conversacion.leido_en)) campos.leido_en = creadoEn
  // Un mensaje nuevo saca la conversación de archivadas.
  if (direccion === 'entrante' && conversacion.archivada) campos.archivada = false
  if (contactoUsername && !conversacion.contacto_username) campos.contacto_username = contactoUsername
  const { data: actualizada } = await supabaseAdmin.from('instagram_dm_conversaciones')
    .update(campos).eq('id', conversacion.id).select('*').maybeSingle()
  return { conversacion: actualizada || { ...conversacion, ...campos }, duplicado: false }
}

// Nombre, usuario y foto del contacto (la foto de Meta caduca a los días).
async function completarPerfilContacto(conversacion, accessToken) {
  if (!accessToken || (conversacion.contacto_username && conversacion.contacto_foto)) return conversacion
  try {
    const perfil = await instagramGraphGet(conversacion.contacto_id, { fields: 'name,username,profile_pic', access_token: accessToken })
    const campos = {
      contacto_username: perfil.username || conversacion.contacto_username,
      contacto_nombre: perfil.name || conversacion.contacto_nombre,
      contacto_foto: perfil.profile_pic || conversacion.contacto_foto,
    }
    await supabaseAdmin.from('instagram_dm_conversaciones').update(campos).eq('id', conversacion.id)
    return { ...conversacion, ...campos }
  } catch (err) {
    console.log('[instagram] no se pudo leer el perfil del contacto:', err.message)
    return conversacion
  }
}

// Palabra clave escrita por DM ("GUIA") → mensaje de la regla. Mismas
// garantías que en comentarios: una vez por regla y contacto, nunca repetido.
async function responderReglaPorDm({ clienteId, igUserId, contactoId, mid, texto, accessToken, contactoUsername }) {
  if (!texto) return
  const { data: reglas } = await supabaseAdmin.from('instagram_dm_reglas')
    .select('*').eq('cliente_id', clienteId).eq('activa', true)
  const regla = (reglas || [])
    .filter(r => ['dm', 'ambos'].includes(r.disparador) && !r.media_id)
    .find(r => comentarioCoincide(texto, r.palabra_clave))
  if (!regla) return

  const { data: envio, error: errorEnvio } = await supabaseAdmin.from('instagram_dm_envios').insert({
    cliente_id: clienteId, regla_id: regla.id, comment_id: `dm:${mid}`, origen: 'dm',
    ig_from_id: String(contactoId), ig_from_username: contactoUsername || null,
    texto_comentario: String(texto).slice(0, 500),
  }).select('id').single()
  if (errorEnvio) return
  const marcar = (campos) => supabaseAdmin.from('instagram_dm_envios').update(campos).eq('id', envio.id)

  const { count: yaEnviados } = await supabaseAdmin.from('instagram_dm_envios')
    .select('id', { count: 'exact', head: true })
    .eq('regla_id', regla.id).eq('ig_from_id', String(contactoId)).eq('estado', 'enviado')
  if (yaEnviados > 0) return marcar({ estado: 'omitido', error: 'Ya había recibido este mensaje' })
  if (!accessToken) return marcar({ estado: 'error', error: 'Instagram no está conectado' })

  try {
    const enviado = await instagramGraphPost(`${igUserId}/messages`, {
      recipient: { id: String(contactoId) },
      message: { text: regla.mensaje },
    }, accessToken, { json: true })
    await marcar({ estado: 'enviado', error: null })
    if (enviado.message_id) {
      await guardarMensajeDm({
        clienteId, igUserId, contactoId, mid: enviado.message_id,
        direccion: 'saliente', texto: regla.mensaje, origen: 'automatico',
      })
    }
  } catch (err) {
    console.error('[instagram] error enviando la respuesta automática por DM:', err.message)
    await marcar({ estado: 'error', error: String(err.message).slice(0, 300) })
    if (tokenInvalido(err)) {
      await marcarConexionInstagram(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
    }
  }
}

async function procesarMensajeInstagram(igUserId, evento) {
  const message = evento?.message
  if (!message?.mid || message.is_deleted || message.is_unsupported) return
  const eco = Boolean(message.is_echo)
  const contactoId = String((eco ? evento.recipient?.id : evento.sender?.id) || '')
  if (!contactoId || contactoId === String(igUserId)) return
  const fecha = evento.timestamp ? new Date(Number(evento.timestamp)) : new Date()

  const { data: conexiones } = await supabaseAdmin.from('instagram_conexiones')
    .select('cliente_id').eq('ig_user_id', String(igUserId)).eq('estado', 'activa')
  if (!conexiones?.length) return console.log(`[instagram] DM para la cuenta ${igUserId}, que no está conectada a ningún cliente`)

  for (const { cliente_id: clienteId } of conexiones) {
    try {
      // Lo que mandamos desde Aify (o una regla) ya está guardado; por si el
      // eco trae otro id, se descarta si el mismo texto salió hace un momento.
      if (eco && message.text) {
        const { data: conversacionPrevia } = await supabaseAdmin.from('instagram_dm_conversaciones')
          .select('id').eq('cliente_id', clienteId).eq('contacto_id', contactoId).maybeSingle()
        if (conversacionPrevia) {
          const { count } = await supabaseAdmin.from('instagram_dm_mensajes')
            .select('id', { count: 'exact', head: true })
            .eq('conversacion_id', conversacionPrevia.id).eq('direccion', 'saliente').neq('origen', 'instagram')
            .eq('texto', String(message.text).slice(0, 4000))
            .gte('creado_en', new Date(fecha.getTime() - 2 * 60 * 1000).toISOString())
          if (count > 0) continue
        }
      }
      const { conversacion, duplicado } = await guardarMensajeDm({
        clienteId, igUserId, contactoId, mid: message.mid,
        direccion: eco ? 'saliente' : 'entrante',
        texto: message.text || null,
        adjuntos: adjuntosMensaje(message.attachments),
        fecha,
      })
      if (duplicado) continue
      const accessToken = await tokenInstagramVigente(clienteId).catch(() => null)
      const completa = await completarPerfilContacto(conversacion, accessToken)
      if (!eco) {
        await responderReglaPorDm({
          clienteId, igUserId, contactoId, mid: message.mid, texto: message.text,
          accessToken, contactoUsername: completa.contacto_username,
        })
      }
    } catch (err) {
      // Sin la migración 0039 las tablas no existen: se registra y sigue.
      console.error('[instagram] no se pudo guardar el DM:', err.message)
    }
  }
}

// Verificación del webhook (Meta → Webhooks → Instagram → Verificar y guardar).
app.get('/api/instagram/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && META_WEBHOOK_VERIFY_TOKEN && req.query['hub.verify_token'] === META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''))
  }
  res.sendStatus(403)
})

// Se responde 200 enseguida (Meta reintenta si tarda) y se procesa después.
app.post('/api/instagram/webhook', (req, res) => {
  if (!supabaseAdmin || !firmaWebhookValida(req)) {
    // Si Meta firma con otro secreto, se ve aquí (y se arregla con META_APP_SECRET).
    console.warn('[instagram] webhook rechazado: firma no válida', req.headers['x-hub-signature-256'] ? '(con cabecera)' : '(sin cabecera)')
    return res.sendStatus(401)
  }
  res.sendStatus(200)
  const entradas = req.body?.object === 'instagram' ? req.body.entry || [] : []
  const campos = entradas.flatMap(e => [...(e.changes || []).map(c => c.field), ...(e.messaging?.length ? ['messaging'] : [])])
  console.log(`[instagram] webhook recibido: object=${req.body?.object} cuentas=${entradas.map(e => e.id).join(',')} campos=${campos.join(',') || '—'}`)
  ;(async () => {
    for (const entrada of entradas) {
      for (const cambio of entrada.changes || []) {
        if (cambio.field === 'comments') await procesarComentarioInstagram(entrada.id, cambio.value)
      }
      for (const evento of entrada.messaging || []) await procesarMensajeInstagram(entrada.id, evento)
    }
  })().catch(err => console.error('[instagram] error procesando el webhook:', err.message))
})

function datosRegla(body, parcial = false) {
  const datos = {}
  const errores = []
  if (!parcial || body.palabraClave !== undefined) {
    const palabra = String(body.palabraClave || '').trim()
    if (!normalizarTexto(palabra) || palabra.length > DM_MAX_PALABRA) errores.push(`La palabra clave tiene que tener entre 1 y ${DM_MAX_PALABRA} caracteres`)
    datos.palabra_clave = palabra
  }
  if (!parcial || body.mensaje !== undefined) {
    const mensaje = String(body.mensaje || '').trim()
    if (!mensaje || mensaje.length > DM_MAX_MENSAJE) errores.push(`El mensaje tiene que tener entre 1 y ${DM_MAX_MENSAJE} caracteres`)
    datos.mensaje = mensaje
  }
  if (!parcial || body.respuestaPublica !== undefined) {
    const respuesta = String(body.respuestaPublica || '').trim()
    if (respuesta.length > DM_MAX_RESPUESTA) errores.push(`La respuesta pública admite como mucho ${DM_MAX_RESPUESTA} caracteres`)
    datos.respuesta_publica = respuesta || null
  }
  if (!parcial || body.media !== undefined) {
    const media = body.media && body.media.id ? body.media : null
    datos.media_id = media ? String(media.id) : null
    datos.media_permalink = media?.enlace || null
    datos.media_miniatura = media?.miniatura || null
    datos.media_texto = media?.texto ? String(media.texto).slice(0, 160) : null
  }
  if (!parcial || body.disparador !== undefined) {
    const disparador = body.disparador || 'comentario'
    if (!DM_DISPARADORES.includes(disparador)) errores.push('Elige si la regla salta con comentarios, con DMs o con los dos')
    datos.disparador = disparador
    // Un DM no va ligado a un reel: esas reglas valen para cualquier mensaje.
    if (disparador === 'dm') Object.assign(datos, { media_id: null, media_permalink: null, media_miniatura: null, media_texto: null })
  }
  if (body.activa !== undefined) datos.activa = Boolean(body.activa)
  return { datos, error: errores[0] || null }
}

// Reglas + últimos envíos + cuántos DMs ha mandado cada regla.
app.get('/api/instagram/dm/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const clienteId = req.clienteInstagram.id
  const [conexion, reglas, envios, enviados] = await Promise.all([
    conexionInstagram(clienteId),
    supabaseAdmin.from('instagram_dm_reglas').select('*').eq('cliente_id', clienteId).order('creado_en', { ascending: false }),
    supabaseAdmin.from('instagram_dm_envios').select('id, regla_id, origen, ig_from_username, texto_comentario, estado, error, creado_en')
      .eq('cliente_id', clienteId).order('creado_en', { ascending: false }).limit(30),
    supabaseAdmin.from('instagram_dm_envios').select('regla_id').eq('cliente_id', clienteId).eq('estado', 'enviado').limit(10000),
  ])
  if (reglas.error) return res.status(500).json({ error: 'No se pudieron leer las reglas. ¿Está aplicada la migración 0036?' })
  const totales = {}
  for (const { regla_id: id } of enviados.data || []) totales[id] = (totales[id] || 0) + 1
  res.json({
    conectado: conexion?.estado === 'activa',
    permisosOk: tienePermisos(conexion, PERMISOS_DM),
    reglas: (reglas.data || []).map(r => ({ ...r, enviados: totales[r.id] || 0 })),
    envios: envios.data || [],
  })
})

app.post('/api/instagram/dm/:clienteId/reglas', requireAuth, requireClienteInstagram(), async (req, res) => {
  const { datos, error } = datosRegla(req.body || {})
  if (error) return res.status(400).json({ error })
  const clienteId = req.clienteInstagram.id
  const { data, error: errorDb } = await supabaseAdmin.from('instagram_dm_reglas')
    .insert({ ...datos, cliente_id: clienteId, creado_por: req.userId }).select('*').single()
  if (errorDb) return res.status(500).json({ error: 'No se pudo guardar la regla' })
  // Por si la cuenta se conectó antes de existir esta función.
  const accessToken = await tokenInstagramVigente(clienteId).catch(() => null)
  if (accessToken) await suscribirWebhookInstagram(accessToken)
  res.json({ regla: { ...data, enviados: 0 } })
})

app.patch('/api/instagram/dm/:clienteId/reglas/:reglaId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const { datos, error } = datosRegla(req.body || {}, true)
  if (error) return res.status(400).json({ error })
  const { data, error: errorDb } = await supabaseAdmin.from('instagram_dm_reglas')
    .update({ ...datos, actualizado_en: new Date().toISOString() })
    .eq('id', req.params.reglaId).eq('cliente_id', req.clienteInstagram.id).select('*').maybeSingle()
  if (errorDb) return res.status(500).json({ error: 'No se pudo guardar la regla' })
  if (!data) return res.status(404).json({ error: 'Regla no encontrada' })
  res.json({ regla: data })
})

app.delete('/api/instagram/dm/:clienteId/reglas/:reglaId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const { error } = await supabaseAdmin.from('instagram_dm_reglas')
    .delete().eq('id', req.params.reglaId).eq('cliente_id', req.clienteInstagram.id)
  if (error) return res.status(500).json({ error: 'No se pudo borrar la regla' })
  res.json({ ok: true })
})

// ── Bandeja: endpoints ──────────────────────────────────────────────────────

// Clientes que ve el usuario (los suyos y los de su organización), como en
// las policies de clientes.
async function clientesDelUsuario(userId) {
  const organizacion = await obtenerOrganizacionDelUsuario(userId)
  let consulta = supabaseAdmin.from('clientes').select('id, nombre, foto_url, archivado')
  consulta = organizacion?.id
    ? consulta.or(`user_id.eq.${userId},organizacion_id.eq.${organizacion.id}`)
    : consulta.eq('user_id', userId)
  const { data } = await consulta.order('nombre')
  return { clientes: data || [], organizacion }
}

function conversacionParaBandeja(c) {
  const entrante = c.ultimo_entrante_en ? new Date(c.ultimo_entrante_en).getTime() : 0
  return {
    ...c,
    noLeida: Boolean(entrante) && (!c.leido_en || entrante > new Date(c.leido_en).getTime()),
    ventanaAbierta: Boolean(entrante) && Date.now() - entrante < DM_VENTANA_MS,
  }
}

// Conversación + comprobación de acceso al cliente al que pertenece.
function requireConversacionDm() {
  return async (req, res, next) => {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Instagram no está disponible en el servidor' })
    if (!UUID_RE.test(req.params.conversacionId || '')) return res.status(404).json({ error: 'Conversación no encontrada' })
    const { data: conversacion } = await supabaseAdmin.from('instagram_dm_conversaciones')
      .select('*').eq('id', req.params.conversacionId).maybeSingle()
    if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada' })
    const { cliente } = await accesoClienteInstagram(conversacion.cliente_id, req.userId)
    if (!cliente) return res.status(404).json({ error: 'Conversación no encontrada' })
    req.conversacionDm = conversacion
    next()
  }
}

// Todas las conversaciones de todos los clientes (o de uno, con ?clienteId=).
app.get('/api/instagram/bandeja', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Instagram no está disponible en el servidor' })
  const { clientes } = await clientesDelUsuario(req.userId)
  const ids = clientes.map(c => c.id)
  if (ids.length === 0) return res.json({ clientes: [], conversaciones: [] })
  const filtroCliente = req.query.clienteId && ids.includes(req.query.clienteId) ? [req.query.clienteId] : ids
  const archivadas = req.query.archivadas === '1'

  const [conexiones, conversaciones, pendientes] = await Promise.all([
    supabaseAdmin.from('instagram_conexiones').select('cliente_id, ig_username, estado, permisos').in('cliente_id', ids),
    supabaseAdmin.from('instagram_dm_conversaciones').select('*')
      .in('cliente_id', filtroCliente).eq('archivada', archivadas)
      .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false }).limit(300),
    // Contadores de no leídas de todos los clientes, aunque se esté filtrando uno.
    supabaseAdmin.from('instagram_dm_conversaciones').select('cliente_id, ultimo_entrante_en, leido_en')
      .in('cliente_id', ids).eq('archivada', false).not('ultimo_entrante_en', 'is', null).limit(5000),
  ])
  if (conversaciones.error) return res.status(500).json({ error: 'No se pudo leer la bandeja. ¿Está aplicada la migración 0039?' })

  const porCliente = Object.fromEntries((conexiones.data || []).map(c => [c.cliente_id, c]))
  const lista = (conversaciones.data || []).map(conversacionParaBandeja)
  const noLeidas = {}
  for (const c of pendientes.data || []) {
    if (conversacionParaBandeja(c).noLeida) noLeidas[c.cliente_id] = (noLeidas[c.cliente_id] || 0) + 1
  }
  res.json({
    clientes: clientes.map(c => {
      const conexion = porCliente[c.id]
      return {
        id: c.id, nombre: c.nombre, foto_url: c.foto_url, archivado: c.archivado,
        igUsername: conexion?.ig_username || null,
        conectado: conexion?.estado === 'activa',
        permisosOk: conexion?.estado === 'activa' && tienePermisos(conexion, PERMISOS_DM),
        noLeidas: noLeidas[c.id] || 0,
      }
    }),
    conversaciones: lista,
  })
})

// Hilo de una conversación. Abrirla la marca como leída.
app.get('/api/instagram/bandeja/conversaciones/:conversacionId', requireAuth, requireConversacionDm(), async (req, res) => {
  const conversacion = req.conversacionDm
  const { data: mensajes, error } = await supabaseAdmin.from('instagram_dm_mensajes')
    .select('id, mid, direccion, texto, adjuntos, origen, creado_en')
    .eq('conversacion_id', conversacion.id).order('creado_en', { ascending: false }).limit(200)
  if (error) return res.status(500).json({ error: 'No se pudieron leer los mensajes' })
  const leidoEn = new Date().toISOString()
  await supabaseAdmin.from('instagram_dm_conversaciones').update({ leido_en: leidoEn }).eq('id', conversacion.id)
  res.json({
    conversacion: conversacionParaBandeja({ ...conversacion, leido_en: leidoEn }),
    mensajes: (mensajes || []).reverse(),
  })
})

app.patch('/api/instagram/bandeja/conversaciones/:conversacionId', requireAuth, requireConversacionDm(), async (req, res) => {
  const campos = {}
  if (req.body?.archivada !== undefined) campos.archivada = Boolean(req.body.archivada)
  if (req.body?.leida !== undefined) campos.leido_en = req.body.leida ? new Date().toISOString() : null
  if (Object.keys(campos).length === 0) return res.status(400).json({ error: 'Nada que cambiar' })
  const { data, error } = await supabaseAdmin.from('instagram_dm_conversaciones')
    .update(campos).eq('id', req.conversacionDm.id).select('*').single()
  if (error) return res.status(500).json({ error: 'No se pudo guardar el cambio' })
  res.json({ conversacion: conversacionParaBandeja(data) })
})

app.post('/api/instagram/bandeja/conversaciones/:conversacionId/responder', requireAuth, requireConversacionDm(), async (req, res) => {
  const conversacion = req.conversacionDm
  const texto = String(req.body?.texto || '').trim()
  if (!texto || texto.length > DM_MAX_TEXTO_BANDEJA) {
    return res.status(400).json({ error: `El mensaje tiene que tener entre 1 y ${DM_MAX_TEXTO_BANDEJA} caracteres` })
  }
  if (!conversacionParaBandeja(conversacion).ventanaAbierta) {
    return res.status(409).json({
      error: 'Instagram solo deja responder en las 24 h siguientes al último mensaje de esta persona. Contéstale desde la app de Instagram.',
      codigo: 'ventana_cerrada',
    })
  }
  const accessToken = await tokenInstagramVigente(conversacion.cliente_id).catch(() => null)
  if (!accessToken) return res.status(409).json({ error: 'El Instagram de este cliente no está conectado', codigo: 'no_conectado' })
  try {
    const enviado = await instagramGraphPost(`${conversacion.ig_user_id}/messages`, {
      recipient: { id: conversacion.contacto_id },
      message: { text: texto },
    }, accessToken, { json: true })
    const { conversacion: actualizada } = await guardarMensajeDm({
      clienteId: conversacion.cliente_id, igUserId: conversacion.ig_user_id, contactoId: conversacion.contacto_id,
      mid: enviado.message_id || `aify:${crypto.randomUUID()}`, direccion: 'saliente', texto,
      origen: 'aify', enviadoPor: req.userId,
    })
    res.json({ ok: true, conversacion: conversacionParaBandeja(actualizada) })
  } catch (err) {
    console.error('[instagram] error respondiendo un DM:', err.message)
    if (tokenInvalido(err)) {
      await marcarConexionInstagram(conversacion.cliente_id, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
      return res.status(409).json({ error: 'El permiso de Instagram de este cliente caducó. Vuelve a conectarlo.', codigo: 'no_conectado' })
    }
    res.status(502).json({ error: `Instagram no aceptó el mensaje: ${err.message}` })
  }
})

// Respuesta sugerida con IA: conoce el negocio del cliente, la conversación y
// los recursos de sus reglas (enlaces que ya manda por DM).
app.post('/api/instagram/bandeja/conversaciones/:conversacionId/sugerir', requireAuth, requireConversacionDm(), rateLimit, requireIaPropia, async (req, res) => {
  const conversacion = req.conversacionDm
  const [{ data: cliente }, { data: mensajes }, { data: reglas }] = await Promise.all([
    supabaseAdmin.from('clientes').select('*').eq('id', conversacion.cliente_id).maybeSingle(),
    supabaseAdmin.from('instagram_dm_mensajes').select('direccion, texto, adjuntos, creado_en')
      .eq('conversacion_id', conversacion.id).order('creado_en', { ascending: false }).limit(20),
    supabaseAdmin.from('instagram_dm_reglas').select('palabra_clave, mensaje').eq('cliente_id', conversacion.cliente_id).eq('activa', true).limit(10),
  ])
  const historial = (mensajes || []).reverse()
    .map(m => `${m.direccion === 'entrante' ? 'CLIENTE' : 'NEGOCIO'}: ${m.texto || `[${resumenMensaje(null, m.adjuntos)}]`}`)
    .join('\n')
  if (!historial) return res.status(400).json({ error: 'Esta conversación todavía no tiene mensajes' })
  const ficha = [
    ['Negocio', cliente?.nombre], ['Sector', cliente?.sector], ['Ubicación', cliente?.ubicacion],
    ['Descripción', cliente?.descripcion], ['Por qué elegirnos', cliente?.por_que_elegirnos],
    ['Rango de precio', cliente?.rango_precio], ['Público', cliente?.publico_objetivo], ['Tono de marca', cliente?.tono],
  ].filter(([, v]) => v).map(([k, v]) => `- ${k}: ${String(v).slice(0, 400)}`).join('\n')
  const recursos = (reglas || []).map(r => `- Si piden "${r.palabra_clave}": ${r.mensaje.slice(0, 300)}`).join('\n')
  const borrador = String(req.body?.borrador || '').trim().slice(0, 500)

  const prompt = `Eres el community manager de este negocio y respondes sus mensajes directos de Instagram.

FICHA DEL NEGOCIO
${ficha || '- (sin datos)'}
${recursos ? `\nRECURSOS QUE YA MANDAMOS POR DM\n${recursos}\n` : ''}
CONVERSACIÓN (la última línea es la más reciente)
${historial}
${borrador ? `\nEl equipo ha empezado a escribir esto; úsalo como intención y mejóralo:\n${borrador}\n` : ''}
Escribe UNA respuesta para enviar ahora como NEGOCIO:
- En el idioma en que escribe el cliente, con el tono de la marca, cercana y breve (1 a 3 frases, como un DM real).
- Responde a lo último que preguntó. Si pide precio, reserva o cita y no está en la ficha, invítale a dar el siguiente paso sin inventar datos.
- Nunca inventes precios, horarios, direcciones ni enlaces que no estén arriba.
- Sin emojis salvo que el cliente los use. Sin comillas, sin firma, sin explicaciones: solo el texto del mensaje.`

  try {
    const texto = (await generarTextoIa(prompt, req.clavesIa, { preferir: 'anthropic', maxTokens: 4000 })).trim().replace(/^["“]|["”]$/g, '')
    res.json({ texto: texto.slice(0, DM_MAX_TEXTO_BANDEJA) })
  } catch (err) {
    console.error('[instagram] error sugiriendo respuesta:', err.message)
    responderErrorIa(res, err)
  }
})

// Trae las conversaciones recientes desde la API (lo que pasó antes de 0039 o
// mientras el webhook no llegaba). Con ?clienteId= solo ese cliente.
async function sincronizarConversacionesCliente(clienteId) {
  const conexion = await conexionInstagram(clienteId)
  if (conexion?.estado !== 'activa' || !tienePermisos(conexion, PERMISOS_DM)) return { omitido: true }
  const accessToken = await tokenInstagramVigente(clienteId)
  if (!accessToken) return { omitido: true }
  const propia = (p) => String(p?.id) === String(conexion.ig_user_id) || (conexion.ig_username && p?.username === conexion.ig_username)

  const datos = await instagramGraphGet('me/conversations', {
    platform: 'instagram',
    fields: 'id,updated_time,participants,messages.limit(20){id,created_time,from,to,message,attachments}',
    limit: DM_SINCRONIZAR_CONVERSACIONES,
    access_token: accessToken,
  })
  let nuevos = 0
  for (const conv of datos.data || []) {
    const contacto = (conv.participants?.data || []).find(p => !propia(p))
    if (!contacto?.id) continue
    // Del más antiguo al más reciente, para que "último mensaje" quede bien.
    const mensajes = [...(conv.messages?.data || [])].reverse()
    let conversacion = null
    for (const m of mensajes) {
      const resultado = await guardarMensajeDm({
        clienteId, igUserId: conexion.ig_user_id, contactoId: contacto.id, mid: m.id,
        direccion: propia(m.from) ? 'saliente' : 'entrante',
        texto: m.message || null, adjuntos: adjuntosMensaje(m.attachments?.data),
        fecha: m.created_time, contactoUsername: contacto.username || null,
      })
      conversacion = resultado.conversacion
      if (!resultado.duplicado) nuevos++
    }
    if (conversacion) await completarPerfilContacto(conversacion, accessToken)
  }
  const conversacionesMeta = (datos.data || []).length
  console.log(`[instagram] sincronizar DMs de ${clienteId} (@${conexion.ig_username}): Meta devolvió ${conversacionesMeta} conversaciones, ${nuevos} mensajes nuevos`)
  return { nuevos, conversacionesMeta }
}

app.post('/api/instagram/bandeja/sincronizar', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Instagram no está disponible en el servidor' })
  const { clientes } = await clientesDelUsuario(req.userId)
  const pedido = req.body?.clienteId
  const objetivo = clientes.filter(c => !c.archivado && (!pedido || c.id === pedido))
  let nuevos = 0
  const errores = []
  // Cuentas sincronizadas y cuántas conversaciones dio Meta de cada una: con la
  // app sin App Review Meta responde una lista vacía (no un error) para los DMs
  // de gente sin rol en la app, y la bandeja lo explica en vez de "Todo al día".
  const cuentas = []
  for (const cliente of objetivo) {
    try {
      const resultado = await sincronizarConversacionesCliente(cliente.id)
      nuevos += resultado.nuevos || 0
      if (!resultado.omitido) cuentas.push({ clienteId: cliente.id, nombre: cliente.nombre, conversacionesMeta: resultado.conversacionesMeta })
    } catch (err) {
      console.error(`[instagram] error sincronizando DMs de ${cliente.id}:`, err.message)
      if (tokenInvalido(err)) {
        await marcarConexionInstagram(cliente.id, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
      }
      errores.push({ clienteId: cliente.id, nombre: cliente.nombre, error: err.message })
    }
  }
  res.json({ nuevos, errores, cuentas })
})

// Últimas publicaciones de la cuenta, para elegir a qué reel va una regla.
app.get('/api/instagram/media/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const clienteId = req.clienteInstagram.id
  const conexion = await conexionInstagram(clienteId)
  const accessToken = await tokenInstagramVigente(clienteId).catch(() => null)
  if (!conexion || !accessToken) return res.status(409).json({ error: 'Este cliente no tiene Instagram conectado', codigo: 'no_conectado' })
  try {
    const datos = await instagramGraphGet(`${conexion.ig_user_id}/media`, {
      fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url',
      limit: 24, access_token: accessToken,
    })
    res.json({
      publicaciones: (datos.data || []).map(m => ({
        id: m.id,
        fecha: m.timestamp,
        tipo: m.media_product_type === 'REELS' ? 'REEL' : m.media_type,
        texto: (m.caption || '').slice(0, 160),
        enlace: m.permalink || null,
        miniatura: m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url) || null,
      })),
    })
  } catch (err) {
    console.error('[instagram] error listando publicaciones:', err.message)
    res.status(502).json({ error: 'Instagram no respondió. Inténtalo de nuevo en unos minutos.' })
  }
})

// Vídeo de un reel del cliente, servido por el backend para que el navegador
// pueda sacar fotogramas (el CDN de Instagram no manda CORS y el canvas
// quedaría bloqueado) y la IA los estudie. Solo vídeos de la cuenta conectada.
app.get('/api/instagram/video/:clienteId/:mediaId', requireAuth, rateLimit, requireClienteInstagram(), async (req, res) => {
  const { mediaId } = req.params
  if (!/^\d+$/.test(mediaId)) return res.status(400).json({ error: 'Publicación no válida' })
  const clienteId = req.clienteInstagram.id
  const conexion = await conexionInstagram(clienteId)
  const accessToken = await tokenInstagramVigente(clienteId).catch(() => null)
  if (!conexion || !accessToken) return res.status(409).json({ error: 'Este cliente no tiene Instagram conectado', codigo: 'no_conectado' })

  let media
  try {
    media = await instagramGraphGet(mediaId, { fields: 'media_type,media_url,username', access_token: accessToken })
  } catch (err) {
    console.error('[instagram] error leyendo el vídeo:', err.message)
    return res.status(404).json({ error: 'No se encontró ese vídeo en el Instagram del cliente' })
  }
  if (conexion.ig_username && media.username && media.username !== conexion.ig_username) {
    return res.status(404).json({ error: 'No se encontró ese vídeo en el Instagram del cliente' })
  }
  if (media.media_type !== 'VIDEO' || !media.media_url) {
    return res.status(400).json({ error: 'Esa publicación no es un vídeo' })
  }

  try {
    const video = await fetch(media.media_url)
    if (!video.ok || !video.body) throw new Error(`el CDN respondió ${video.status}`)
    const tamaño = Number(video.headers.get('content-length')) || 0
    if (tamaño > IG_VIDEO_MAX_BYTES) return res.status(413).json({ error: 'El vídeo es demasiado grande para estudiarlo' })
    res.setHeader('Content-Type', video.headers.get('content-type') || 'video/mp4')
    if (tamaño) res.setHeader('Content-Length', String(tamaño))
    res.setHeader('Cache-Control', 'private, max-age=600')
    Readable.fromWeb(video.body).pipe(res)
  } catch (err) {
    console.error('[instagram] error descargando el vídeo:', err.message)
    if (!res.headersSent) res.status(502).json({ error: 'Instagram no ha dejado descargar el vídeo. Inténtalo de nuevo.' })
  }
})

// ─── Instagram: publicar desde el calendario ─────────────────────────────────
//
// La API no programa: guarda la hora en instagram_publicaciones y un proceso
// cada minuto (más /api/instagram/publicar/tick para un cron externo, porque
// el plan gratuito de Render se duerme) publica lo que toque en tres pasos:
// crear contenedor en Meta → esperar a que esté FINISHED → media_publish.
// Los archivos están en el bucket privado "publicaciones"; Meta los descarga
// de una URL firmada. Límite de Meta: 100 publicaciones por cuenta en 24 h.

const BUCKET_PUBLICACIONES = 'publicaciones'
const URL_FIRMADA_META_SEGUNDOS = 24 * 60 * 60
const PUBLICAR_TIEMPO_MAX_MS = 30 * 60 * 1000 // un reel que no termina de procesarse en 30 min se da por fallido
const PUBLICAR_INTERVALO_MS = 60 * 1000
const INSTAGRAM_CRON_SECRET = process.env.INSTAGRAM_CRON_SECRET
const TIPOS_PUBLICACION = ['post', 'carrusel', 'reel', 'historia']
const CAMPOS_PUBLICACION = ['id', 'post_id', 'tipo', 'archivos', 'portada_ruta', 'caption', 'compartir_en_feed', 'publicar_en', 'estado', 'ig_media_id', 'permalink', 'publicado_en', 'error', 'actualizado_en', 'es_trial', 'trial_graduacion']

// Lo que ve el navegador de una publicación. Se lee con select('*') para que
// funcione con y sin la migración 0042 (columnas de Trial). "instagram" es lo
// que Instagram dice que publicó (tipo y feed), para comparar con lo programado.
function publicacionParaCliente(fila) {
  if (!fila) return fila
  const pub = Object.fromEntries(CAMPOS_PUBLICACION.map(c => [c, fila[c] ?? null]))
  pub.es_trial = Boolean(fila.es_trial)
  pub.instagram = fila.contenedores?.instagram || null
  pub.portada_nombre = fila.contenedores?.portada_nombre || null
  pub.archivos_borrados = Boolean(fila.contenedores?.archivos_borrados)
  return pub
}

// Trial Reels: MANUAL = la cuenta decide desde Instagram si se comparte con los
// seguidores; SS_PERFORMANCE = Instagram lo comparte solo si funciona bien.
const GRADUACIONES_TRIAL = ['MANUAL', 'SS_PERFORMANCE']

function validarPublicacion(body, prefijo) {
  const tipo = body.tipo
  if (!TIPOS_PUBLICACION.includes(tipo)) return 'Tipo de publicación no válido'
  const archivos = Array.isArray(body.archivos) ? body.archivos : []
  if (archivos.some(a => !a || typeof a.ruta !== 'string' || !a.ruta.startsWith(prefijo) || !['imagen', 'video'].includes(a.tipo)
    || (a.nombre != null && (typeof a.nombre !== 'string' || a.nombre.length > 255))
    || (a.bytes != null && !Number.isFinite(a.bytes)))) {
    return 'Archivo no válido'
  }
  if (body.portadaNombre != null && (typeof body.portadaNombre !== 'string' || body.portadaNombre.length > 255)) return 'Portada no válida'
  if (tipo === 'carrusel' && (archivos.length < 2 || archivos.length > 10)) return 'Un carrusel lleva entre 2 y 10 archivos'
  if (tipo !== 'carrusel' && archivos.length !== 1) return 'Esta publicación lleva un solo archivo'
  if (tipo === 'post' && archivos[0].tipo !== 'imagen') return 'Un post lleva una imagen; para vídeo usa reel'
  if (tipo === 'reel' && archivos[0].tipo !== 'video') return 'Un reel lleva un vídeo'
  if (body.portadaRuta && (typeof body.portadaRuta !== 'string' || !body.portadaRuta.startsWith(prefijo))) return 'Portada no válida'
  if (String(body.caption || '').length > 2200) return 'El texto admite como mucho 2.200 caracteres'
  if (Number.isNaN(new Date(body.publicarEn).getTime())) return 'Fecha de publicación no válida'
  if (body.esTrial && tipo !== 'reel') return 'Solo un reel se puede publicar como Trial Reel'
  if (body.trialGraduacion != null && !GRADUACIONES_TRIAL.includes(body.trialGraduacion)) return 'Opción de Trial Reel no válida'
  return null
}

app.get('/api/instagram/publicar/:clienteId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const clienteId = req.clienteInstagram.id
  const [conexion, { data, error }] = await Promise.all([
    conexionInstagram(clienteId),
    supabaseAdmin.from('instagram_publicaciones').select('*').eq('cliente_id', clienteId).order('publicar_en', { ascending: false }).limit(200),
  ])
  if (error) return res.status(500).json({ error: 'No se pudieron leer las publicaciones. ¿Está aplicada la migración 0036?' })
  res.json({
    conectado: conexion?.estado === 'activa',
    permisosOk: tienePermisos(conexion, [PERMISO_PUBLICAR]),
    publicaciones: (data || []).map(publicacionParaCliente),
  })
})

// Programa (o reprograma) la publicación de un post del calendario. La usan
// el PUT de abajo y el MCP (programar_publicacion, mcp/servidor.js). Devuelve
// { publicacion } o { estado, error } con el código HTTP del fallo.
async function programarPublicacion({ clienteId, organizacionId, postId, body, userId }) {
  // Misma ruta que sube el navegador: <organización>/<cliente>/...
  const prefijo = `${organizacionId}/${clienteId}/`
  const error = validarPublicacion(body || {}, prefijo)
  if (error) return { estado: 400, error }

  const { data: post } = await supabaseAdmin.from('calendario_posts').select('id').eq('id', postId).eq('cliente_id', clienteId).maybeSingle()
  if (!post) return { estado: 404, error: 'Post no encontrado' }
  const { data: actual } = await supabaseAdmin.from('instagram_publicaciones').select('*').eq('post_id', post.id).maybeSingle()
  if (actual && ['procesando', 'publicado'].includes(actual.estado)) {
    return { estado: 409, error: actual.estado === 'publicado' ? 'Este post ya está publicado' : 'Este post se está publicando ahora mismo' }
  }

  const { data, error: errorDb } = await supabaseAdmin.from('instagram_publicaciones').upsert({
    cliente_id: clienteId,
    post_id: post.id,
    tipo: body.tipo,
    // nombre y tamaño del archivo original: para el resumen de lo programado.
    archivos: body.archivos.map(a => ({ ruta: a.ruta, tipo: a.tipo, ...(a.nombre ? { nombre: a.nombre } : {}), ...(a.bytes ? { bytes: a.bytes } : {}) })),
    portada_ruta: body.tipo === 'reel' ? body.portadaRuta || null : null,
    caption: body.tipo === 'historia' ? null : String(body.caption || ''),
    compartir_en_feed: body.compartirEnFeed !== false,
    // Las columnas de Trial (migración 0042) solo se escriben si el reel es
    // Trial o si ya lo era: así programar sin Trial funciona sin la migración.
    ...(body.esTrial || (body.esTrial === false && actual?.es_trial)
      ? { es_trial: !!body.esTrial && body.tipo === 'reel', trial_graduacion: body.trialGraduacion || 'MANUAL' }
      : {}),
    publicar_en: new Date(body.publicarEn).toISOString(),
    estado: 'programado',
    contenedores: body.tipo === 'reel' && body.portadaRuta && body.portadaNombre ? { portada_nombre: body.portadaNombre } : null,
    procesando_desde: null,
    error: null,
    intentos: 0,
    creado_por: userId,
    actualizado_en: new Date().toISOString(),
  }, { onConflict: 'post_id' }).select('*').single()
  if (errorDb) {
    const sinMigracion = body.esTrial && /es_trial|trial_graduacion/.test(errorDb.message || '')
    return { estado: 500, error: sinMigracion ? 'Para programar Trial Reels falta aplicar la migración 0042' : 'No se pudo programar la publicación' }
  }
  // Archivo sustituido: el anterior ya no lo usa nadie (ver limpieza del bucket).
  if (actual) {
    const nuevas = new Set(rutasDePublicacion(data))
    borrarArchivosSinUso(rutasDePublicacion(actual).filter(r => !nuevas.has(r)))
      .catch(err => console.error('[storage] no se pudo borrar el archivo sustituido:', err.message))
  }
  return { publicacion: publicacionParaCliente(data) }
}

app.put('/api/instagram/publicar/:clienteId/:postId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const organizacion = await obtenerOrganizacionDelUsuario(req.userId)
  const resultado = await programarPublicacion({
    clienteId: req.clienteInstagram.id,
    organizacionId: organizacion?.id,
    postId: req.params.postId,
    body: req.body,
    userId: req.userId,
  })
  if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error })
  res.json({ publicacion: resultado.publicacion })
})

app.delete('/api/instagram/publicar/:clienteId/:postId', requireAuth, requireClienteInstagram(), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('instagram_publicaciones')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('post_id', req.params.postId).eq('cliente_id', req.clienteInstagram.id).in('estado', ['programado', 'error'])
    .select('*').maybeSingle()
  if (error) return res.status(500).json({ error: 'No se pudo cancelar' })
  if (!data) return res.status(409).json({ error: 'Solo se puede cancelar una publicación programada o con error' })
  res.json({ publicacion: publicacionParaCliente(data) })
})

async function actualizarPublicacion(id, campos) {
  const { error } = await supabaseAdmin.from('instagram_publicaciones')
    .update({ ...campos, actualizado_en: new Date().toISOString() }).eq('id', id)
  if (error) console.error('[instagram] error actualizando la publicación:', error.message)
}

async function falloPublicacion(pub, mensaje, err) {
  console.error('[instagram] publicación fallida', pub.id, ':', err?.message || mensaje)
  await actualizarPublicacion(pub.id, { estado: 'error', error: String(mensaje).slice(0, 300) })
  if (err && tokenInvalido(err)) {
    await marcarConexionInstagram(pub.cliente_id, { estado: 'caducada', ultimo_error: 'El permiso de Instagram caducó o se revocó' })
  }
}

async function urlFirmadaPublicacion(ruta) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_PUBLICACIONES).createSignedUrl(ruta, URL_FIRMADA_META_SEGUNDOS)
  if (error || !data?.signedUrl) throw new Error(`No se encontró el archivo ${ruta}`)
  return data.signedUrl
}

async function credencialesPublicacion(pub) {
  const conexion = await conexionInstagram(pub.cliente_id)
  const accessToken = conexion?.estado === 'activa' ? await tokenInstagramVigente(pub.cliente_id) : null
  return { igUserId: conexion?.ig_user_id, accessToken }
}

// Paso 1: crea los contenedores en Meta (para un carrusel, los hijos; el
// contenedor padre se crea en avanzarPublicacion cuando los hijos están listos).
async function iniciarPublicacion(pub) {
  const { igUserId, accessToken } = await credencialesPublicacion(pub)
  if (!accessToken) return falloPublicacion(pub, 'Instagram no está conectado o hay que reconectarlo')

  try {
    const limite = await instagramGraphGet(`${igUserId}/content_publishing_limit`, { fields: 'quota_usage,config', access_token: accessToken })
    const uso = limite.data?.[0]
    if (uso?.config?.quota_total && uso.quota_usage >= uso.config.quota_total) {
      // Se vuelve a intentar en media hora en vez de fallar.
      return actualizarPublicacion(pub.id, {
        estado: 'programado', procesando_desde: null,
        publicar_en: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        error: 'Instagram ha llegado a su límite de publicaciones de 24 h; se reintentará en 30 minutos',
      })
    }
  } catch (err) {
    if (tokenInvalido(err)) return falloPublicacion(pub, 'El permiso de Instagram caducó o se revocó. Vuelve a conectar la cuenta.', err)
    // Si no se puede leer el límite, se intenta publicar igualmente.
  }

  try {
    const archivos = await Promise.all(pub.archivos.map(async a => ({ ...a, url: await urlFirmadaPublicacion(a.ruta) })))
    const crear = (params) => instagramGraphPost(`${igUserId}/media`, params, accessToken).then(r => r.id)
    let contenedores
    if (pub.tipo === 'carrusel') {
      const hijos = []
      for (const a of archivos) {
        hijos.push(await crear(a.tipo === 'video'
          ? { is_carousel_item: true, media_type: 'VIDEO', video_url: a.url }
          : { is_carousel_item: true, image_url: a.url }))
      }
      contenedores = { hijos, contenedor: null }
    } else if (pub.tipo === 'reel') {
      contenedores = { contenedor: await crear({
        media_type: 'REELS',
        video_url: archivos[0].url,
        caption: pub.caption || undefined,
        share_to_feed: pub.compartir_en_feed,
        cover_url: pub.portada_ruta ? await urlFirmadaPublicacion(pub.portada_ruta) : undefined,
        // Trial Reel: Meta lo enseña primero solo a no seguidores.
        trial_params: pub.es_trial ? JSON.stringify({ graduation_strategy: pub.trial_graduacion || 'MANUAL' }) : undefined,
      }) }
    } else if (pub.tipo === 'historia') {
      contenedores = { contenedor: await crear(archivos[0].tipo === 'video'
        ? { media_type: 'STORIES', video_url: archivos[0].url }
        : { media_type: 'STORIES', image_url: archivos[0].url }) }
    } else {
      contenedores = { contenedor: await crear({ image_url: archivos[0].url, caption: pub.caption || undefined }) }
    }
    contenedores = { ...pub.contenedores, ...contenedores }
    await actualizarPublicacion(pub.id, { contenedores })
    await avanzarPublicacion({ ...pub, contenedores }, { igUserId, accessToken })
  } catch (err) {
    await falloPublicacion(pub, `Instagram rechazó el contenido: ${err.message}${pub.es_trial ? ' (¿la cuenta tiene activados los Trial Reels?)' : ''}`, err)
  }
}

async function estadoContenedor(id, accessToken) {
  const datos = await instagramGraphGet(id, { fields: 'status_code,status', access_token: accessToken })
  return { codigo: datos.status_code, detalle: datos.status }
}

// Paso 2 y 3: espera a que Meta procese y publica. Se llama en cada vuelta
// del proceso mientras la publicación siga en "procesando".
async function avanzarPublicacion(pub, credenciales) {
  if (pub.procesando_desde && Date.now() - new Date(pub.procesando_desde).getTime() > PUBLICAR_TIEMPO_MAX_MS) {
    return falloPublicacion(pub, 'Instagram tardó demasiado en procesar el archivo')
  }
  const { igUserId, accessToken } = credenciales || await credencialesPublicacion(pub)
  if (!accessToken) return falloPublicacion(pub, 'Instagram no está conectado o hay que reconectarlo')
  const contenedores = pub.contenedores || {}

  try {
    if (!contenedores.contenedor && contenedores.hijos?.length) {
      const estados = await Promise.all(contenedores.hijos.map(id => estadoContenedor(id, accessToken)))
      const roto = estados.find(e => ['ERROR', 'EXPIRED'].includes(e.codigo))
      if (roto) return falloPublicacion(pub, `Instagram no pudo procesar un archivo del carrusel${roto.detalle ? `: ${roto.detalle}` : ''}`)
      if (!estados.every(e => e.codigo === 'FINISHED')) return
      const padre = await instagramGraphPost(`${igUserId}/media`, {
        media_type: 'CAROUSEL', children: contenedores.hijos.join(','), caption: pub.caption || undefined,
      }, accessToken)
      contenedores.contenedor = padre.id
      await actualizarPublicacion(pub.id, { contenedores })
    }
    if (!contenedores.contenedor) return falloPublicacion(pub, 'No hay contenido preparado en Instagram')

    const { codigo, detalle } = await estadoContenedor(contenedores.contenedor, accessToken)
    if (['ERROR', 'EXPIRED'].includes(codigo)) return falloPublicacion(pub, `Instagram no pudo procesar el archivo${detalle ? `: ${detalle}` : ''}`)
    if (codigo !== 'FINISHED') return

    const publicado = await instagramGraphPost(`${igUserId}/media_publish`, { creation_id: contenedores.contenedor }, accessToken)
    // Lo que Instagram dice que ha publicado, para comprobarlo contra lo programado.
    const media = await instagramGraphGet(publicado.id, { fields: 'permalink,media_type,media_product_type,is_shared_to_feed', access_token: accessToken })
      .catch(() => instagramGraphGet(publicado.id, { fields: 'permalink', access_token: accessToken }))
      .catch(() => ({}))
    await actualizarPublicacion(pub.id, {
      contenedores: {
        ...contenedores,
        instagram: {
          producto: media.media_product_type || null, // FEED | REELS | STORY
          media: media.media_type || null,            // IMAGE | VIDEO | CAROUSEL_ALBUM
          en_feed: typeof media.is_shared_to_feed === 'boolean' ? media.is_shared_to_feed : null,
          trial_pedido: Boolean(pub.es_trial),
        },
      },
      estado: 'publicado', ig_media_id: publicado.id, permalink: media.permalink || null,
      publicado_en: new Date().toISOString(), error: null,
    })
    await supabaseAdmin.from('calendario_posts').update({ estado: 'publicado' }).eq('id', pub.post_id)
    // Ya está en Instagram: sus archivos solo ocupan Storage (ver limpieza del bucket).
    if (await borrarArchivosSinUso(rutasDePublicacion(pub)).catch(err => console.error('[storage]', err.message))) {
      const { data: fila } = await supabaseAdmin.from('instagram_publicaciones').select('contenedores').eq('id', pub.id).maybeSingle()
      await actualizarPublicacion(pub.id, { contenedores: { ...(fila?.contenedores || contenedores), archivos_borrados: true } })
    }
    await cerrarTareaDelPost(pub.post_id, 'Instagram')
  } catch (err) {
    await falloPublicacion(pub, `Instagram rechazó la publicación: ${err.message}`, err)
  }
}

// Publicada (en Instagram o TikTok): su tarjeta de producción pasa a la
// columna final («Hecho») de su organización (#85). Si no tiene columna
// final, se queda donde está.
async function cerrarTareaDelPost(postId, red) {
  const { data: tarea } = await supabaseAdmin.from('tareas').select('id, cliente_id').eq('post_id', postId).eq('completada', false).limit(1).maybeSingle()
  if (!tarea) return
  const { data: cliente } = await supabaseAdmin.from('clientes').select('organizacion_id').eq('id', tarea.cliente_id).maybeSingle()
  const { data: final } = await supabaseAdmin.from('tablero_columnas').select('id').eq('tablero', 'tareas').eq('organizacion_id', cliente?.organizacion_id).eq('es_final', true).limit(1).maybeSingle()
  if (final) await supabaseAdmin.from('tareas').update({ columna_id: final.id, completada: true, completada_en: new Date().toISOString() }).eq('id', tarea.id)
  else console.warn(`[${red}] no hay columna final para cerrar la tarea`, tarea.id)
}

let cicloPublicacionesEnCurso = false
async function cicloPublicaciones() {
  if (cicloPublicacionesEnCurso || !instagramConfigurado()) return
  cicloPublicacionesEnCurso = true
  try {
    const ahora = new Date().toISOString()
    const { data: tocan } = await supabaseAdmin.from('instagram_publicaciones')
      .select('*').eq('estado', 'programado').lte('publicar_en', ahora).order('publicar_en').limit(10)
    for (const pub of tocan || []) {
      // Se "reserva" con un update condicionado: si otra vuelta ya la cogió, no devuelve fila.
      const { data: reservada } = await supabaseAdmin.from('instagram_publicaciones')
        .update({ estado: 'procesando', procesando_desde: ahora, intentos: pub.intentos + 1, error: null, actualizado_en: ahora })
        .eq('id', pub.id).eq('estado', 'programado').select('*').maybeSingle()
      if (reservada) await iniciarPublicacion(reservada)
    }

    const { data: enCurso } = await supabaseAdmin.from('instagram_publicaciones')
      .select('*').eq('estado', 'procesando').lt('procesando_desde', ahora).limit(20)
    for (const pub of enCurso || []) await avanzarPublicacion(pub)
  } catch (err) {
    console.error('[instagram] error en el ciclo de publicaciones:', err.message)
  } finally {
    cicloPublicacionesEnCurso = false
  }
}

if (supabaseAdmin) setInterval(cicloPublicaciones, PUBLICAR_INTERVALO_MS)

// ─── Reels a las 24 h (base del clasificador bueno / ganador / malo) ──────────
// Una vez por reel, entre las 24 y las 48 h de publicarse, guarda sus métricas
// en instagram_reels_24h. Corre como mucho cada 15 min, colgado del mismo tick
// que las publicaciones; si el servidor duerme más de 24 h, esos reels se
// pierden (la foto ya no sería "a las 24 h").
const REELS_24H_INTERVALO_MS = 15 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
let cicloReels24hEnCurso = false
let ultimoCicloReels24h = 0

async function fotoReels24hCliente(conexion) {
  const accessToken = await tokenInstagramVigente(conexion.cliente_id)
  if (!accessToken) return 0
  const res = await instagramGraphGet(`${conexion.ig_user_id}/media`, {
    fields: 'id,caption,media_product_type,permalink,timestamp', limit: 25, access_token: accessToken,
  })
  const ahora = Date.now()
  const candidatos = (res.data || []).filter(m => {
    const edad = ahora - new Date(m.timestamp).getTime()
    return m.media_product_type === 'REELS' && edad >= 24 * HORA_MS && edad < 48 * HORA_MS
  })
  if (!candidatos.length) return 0

  const { data: yaTomados } = await supabaseAdmin.from('instagram_reels_24h')
    .select('media_id').eq('cliente_id', conexion.cliente_id).in('media_id', candidatos.map(m => m.id))
  const tomados = new Set((yaTomados || []).map(f => f.media_id))
  let metricas = IG_METRICAS_MEDIA.REEL
  let nuevos = 0
  for (const m of candidatos.filter(c => !tomados.has(c.id))) {
    const insights = await pedirInsights(`${m.id}/insights`, metricas, { access_token: accessToken }, (validas) => { metricas = validas })
    const { error } = await supabaseAdmin.from('instagram_reels_24h').upsert({
      cliente_id: conexion.cliente_id,
      media_id: m.id,
      publicado_en: m.timestamp,
      tomado_en: new Date().toISOString(),
      horas: Math.round((Date.now() - new Date(m.timestamp).getTime()) / HORA_MS * 10) / 10,
      enlace: m.permalink || null,
      texto: (m.caption || '').slice(0, 160),
      visualizaciones: insights.views ?? null,
      alcance: insights.reach ?? null,
      me_gusta: insights.likes ?? null,
      comentarios: insights.comments ?? null,
      guardados: insights.saved ?? null,
      compartidos: insights.shares ?? null,
      visto_medio_ms: insights.ig_reels_avg_watch_time ?? null,
      saltos: insights.reels_skip_rate ?? null,
    }, { onConflict: 'cliente_id,media_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    nuevos++
  }
  return nuevos
}

async function cicloReels24h() {
  if (cicloReels24hEnCurso || !instagramConfigurado()) return
  if (Date.now() - ultimoCicloReels24h < REELS_24H_INTERVALO_MS) return
  cicloReels24hEnCurso = true
  ultimoCicloReels24h = Date.now()
  try {
    const { data: conexiones } = await supabaseAdmin.from('instagram_conexiones')
      .select('cliente_id, ig_user_id, ig_username').eq('estado', 'activa')
    for (const conexion of conexiones || []) {
      try {
        const nuevos = await fotoReels24hCliente(conexion)
        if (nuevos) console.log(`[instagram] reels 24 h de @${conexion.ig_username}: ${nuevos} nuevos`)
      } catch (err) {
        // Una cuenta caída (token caducado, permisos) no frena a las demás.
        console.error(`[instagram] reels 24 h de ${conexion.cliente_id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[instagram] error en el ciclo de reels 24 h:', err.message)
  } finally {
    cicloReels24hEnCurso = false
  }
}

if (supabaseAdmin) setInterval(cicloReels24h, PUBLICAR_INTERVALO_MS)

// ─── Limpieza del bucket «publicaciones» ──────────────────────────────────────
// El plan gratuito de Supabase da 1 GB de Storage y un reel pesa 20-40 MB. Lo
// que ya está en Instagram no hace falta guardarlo: se borra al publicarse y al
// sustituir el archivo de un post programado. Además, cada 6 h se barre lo que
// no usa ninguna publicación sin publicar ni ninguna secuencia de historias y
// tiene más de 24 h (subidas que no se llegaron a programar, posts borrados del
// calendario, lo publicado antes de esta limpieza). Lo programado, lo cancelado
// y lo que falló conserva sus archivos.
const LIMPIEZA_BUCKET_INTERVALO_MS = 6 * 60 * 60 * 1000
const LIMPIEZA_BUCKET_ANTIGUEDAD_MS = 24 * 60 * 60 * 1000
let limpiezaBucketEnCurso = false
let ultimaLimpiezaBucket = 0

function rutasDePublicacion(pub) {
  return [...(pub?.archivos || []).map(a => a?.ruta), pub?.portada_ruta].filter(Boolean)
}

async function borrarArchivosBucket(rutas) {
  for (let i = 0; i < rutas.length; i += 100) {
    const { error } = await supabaseAdmin.storage.from(BUCKET_PUBLICACIONES).remove(rutas.slice(i, i + 100))
    if (error) {
      console.error('[storage] no se pudieron borrar archivos de publicaciones:', error.message)
      return false
    }
  }
  return true
}

// Todos los archivos del bucket (<organización>/<cliente>/…), carpeta a carpeta.
async function listarBucketPublicaciones(prefijo = '') {
  const archivos = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_PUBLICACIONES).list(prefijo, { limit: 1000, offset })
    if (error) throw new Error(`no se pudo listar «${prefijo || '/'}»: ${error.message}`)
    for (const item of data) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name
      if (!item.id) archivos.push(...await listarBucketPublicaciones(ruta))
      else if (!item.name.startsWith('.')) archivos.push({ ruta, bytes: item.metadata?.size || 0, creado: item.created_at })
    }
    if (data.length < 1000) return archivos
  }
}

// Cualquier texto dentro de la fila puede ser una ruta del bucket.
function recogerTextos(valor, destino) {
  if (typeof valor === 'string') destino.add(valor)
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) recogerTextos(v, destino)
}

// Rutas que usa alguna publicación sin publicar (de Instagram o TikTok) o
// alguna secuencia de historias. Si falla la lectura, lanza: sin la lista
// entera de lo que se usa no se borra nada. Sin la migración 0049 la tabla de
// TikTok no existe y no tiene nada que proteger: se salta.
async function rutasEnUsoBucket() {
  const enUso = new Set()
  const tablas = [['instagram_publicaciones', 'estado, archivos, portada_ruta'], ['historias_secuencias', 'historias'], ['tiktok_publicaciones', 'estado, archivos']]
  for (const [tabla, campos] of tablas) {
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabaseAdmin.from(tabla).select(campos).range(desde, desde + 999)
      if (error && tabla === 'tiktok_publicaciones' && esTablaTikTokInexistente(error)) break
      if (error) throw new Error(`no se pudo leer ${tabla}: ${error.message}`)
      for (const fila of data) if (fila.estado !== 'publicado') recogerTextos(fila, enUso)
      if (data.length < 1000) break
    }
  }
  return enUso
}

// Borra las rutas que ya no usa nadie (otro post o una secuencia pueden compartir archivo).
async function borrarArchivosSinUso(rutas) {
  if (!rutas.length) return true
  const enUso = await rutasEnUsoBucket()
  return borrarArchivosBucket(rutas.filter(r => !enUso.has(r)))
}

async function limpiarBucketPublicaciones() {
  if (limpiezaBucketEnCurso || !supabaseAdmin) return
  if (Date.now() - ultimaLimpiezaBucket < LIMPIEZA_BUCKET_INTERVALO_MS) return
  limpiezaBucketEnCurso = true
  ultimaLimpiezaBucket = Date.now()
  try {
    const enUso = await rutasEnUsoBucket()
    const limite = Date.now() - LIMPIEZA_BUCKET_ANTIGUEDAD_MS
    const sobran = (await listarBucketPublicaciones())
      .filter(a => !enUso.has(a.ruta) && new Date(a.creado).getTime() < limite)
    if (!sobran.length) return
    const megas = sobran.reduce((t, a) => t + a.bytes, 0) / 1024 / 1024
    if (await borrarArchivosBucket(sobran.map(a => a.ruta))) {
      console.log(`[storage] limpieza de publicaciones: ${sobran.length} archivos, ${megas.toFixed(0)} MB liberados`)
    }
  } catch (err) {
    console.error('[storage] error en la limpieza de publicaciones:', err.message)
  } finally {
    limpiezaBucketEnCurso = false
  }
}

if (supabaseAdmin) setInterval(limpiarBucketPublicaciones, PUBLICAR_INTERVALO_MS)

// Para un cron externo (cron-job.org, GitHub Actions…) que despierte el
// servidor cada minuto: en el plan gratuito de Render el setInterval no
// corre mientras el servicio duerme. También mueve las publicaciones de TikTok.
app.post('/api/instagram/publicar/tick', async (req, res) => {
  if (!INSTAGRAM_CRON_SECRET || req.headers['x-cron-secret'] !== INSTAGRAM_CRON_SECRET) return res.sendStatus(401)
  await cicloPublicaciones()
  await cicloPublicacionesTikTok()
  // Sin await: el cron externo no tiene que esperar a Meta ni a TikTok (ya se limitan solos a cada 15 min).
  cicloReels24h()
  cicloMetricasTikTok()
  limpiarBucketPublicaciones()
  res.json({ ok: true })
})

// ─── TikTok: conectar la cuenta y publicar desde el calendario ───────────────
//
// Calcado de Instagram (docs/tiktok-setup.md, 0049_tiktok.sql). Login Kit v2
// para conectar y Content Posting API (Direct Post) para publicar. TikTok no
// programa: la hora vive en tiktok_publicaciones y cicloPublicacionesTikTok
// (cada minuto y en el tick de Instagram) llama a init cuando toca y luego a
// status/fetch hasta que TikTok termina. TikTok descarga los archivos
// (PULL_FROM_URL) de /api/tiktok/medios/<token firmado>, un prefijo que hay
// que verificar en el portal de TikTok.
// Los tokens viven en tiktok_tokens, que solo lee la service role.

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3011/api/tiktok/callback'
// Base pública del backend para las URLs de los archivos (lo que se verifica
// en TikTok). Por defecto, el origen de la redirect URI.
const TIKTOK_MEDIOS_BASE_URL = (process.env.TIKTOK_MEDIOS_BASE_URL || (() => {
  try { return new URL(TIKTOK_REDIRECT_URI).origin } catch { return 'http://localhost:3011' }
})()).replace(/\/+$/, '')
const TIKTOK_VERIFICACION_ARCHIVO = process.env.TIKTOK_VERIFICACION_ARCHIVO
const TIKTOK_VERIFICACION_CONTENIDO = process.env.TIKTOK_VERIFICACION_CONTENIDO
// La app y cada sandbox verifican el prefijo con su propio archivo
// tiktok<código>.txt, cuyo contenido es tiktok-developers-site-verification=<código>.
// Los códigos son públicos (TikTok los lee de una URL abierta), así que van aquí;
// TIKTOK_VERIFICACION_CODIGOS (separados por comas) añade más sin tocar el código.
const TIKTOK_VERIFICACION_CODIGOS = new Set([
  'J2ID2jvF4wh41VoTGB3ZsNmfk7NX7ONE', // app de producción (2026-10-29)
  'G609dYD6tVJWyrUhZdyP8Akfyo80GVUM', // sandbox dylanstillavato (2026-10-29)
  ...String(process.env.TIKTOK_VERIFICACION_CODIGOS || '').split(',').map(c => c.trim()).filter(Boolean),
])
// Hasta pasar la auditoría de Direct Post, TikTok solo acepta publicaciones
// privadas (SELF_ONLY) en cuentas privadas. Al aprobarla, TIKTOK_AUDITADA=1.
const TIKTOK_AUDITADA = process.env.TIKTOK_AUDITADA === '1'
const TIKTOK_API = 'https://open.tiktokapis.com/v2'
// user.info.stats y video.list son para las métricas (fase 2): se piden ya para
// no obligar a reconectar después.
const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish', 'video.upload'].join(',')
const PERMISO_PUBLICAR_TIKTOK = 'video.publish'
const TIKTOK_STATE_TTL_MS = 15 * 60 * 1000
const TIKTOK_REFRESCAR_ANTES_MS = 60 * 60 * 1000 // el access token dura 24 h: se renueva si le queda menos de 1 h
const TIKTOK_MEDIOS_TTL_MS = 2 * 60 * 60 * 1000 // TikTok descarga en la hora siguiente al init
const TIKTOK_WEBHOOK_TOLERANCIA_S = 5 * 60
const TIPOS_TIKTOK = ['video', 'fotos']
const PRIVACIDADES_TIKTOK = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']
const TIKTOK_MAX_TITULO_VIDEO = 2200
const TIKTOK_MAX_TITULO_FOTOS = 90
const TIKTOK_MAX_DESCRIPCION_FOTOS = 4000
const TIKTOK_MAX_FOTOS = 35

function tiktokConfigurado() {
  return Boolean(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET && supabaseAdmin)
}

const esTablaTikTokInexistente = (error) => Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /tiktok_/.test(error.message || ''))

class TikTokApiError extends Error {
  constructor(message, { status, code, logId } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.logId = logId
  }
}

function tokenTikTokInvalido(err) {
  return err instanceof TikTokApiError && (err.code === 'access_token_invalid' || err.status === 401)
}

// Firma genérica (HMAC con el client secret): state del OAuth y token de los
// archivos. base64url(payload).firma
function firmarCargaTikTok(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const firma = crypto.createHmac('sha256', TIKTOK_CLIENT_SECRET).update(cuerpo).digest('base64url')
  return `${cuerpo}.${firma}`
}

function leerCargaTikTok(token) {
  const [cuerpo, firma] = String(token || '').split('.')
  if (!cuerpo || !firma || !TIKTOK_CLIENT_SECRET) return null
  const esperada = crypto.createHmac('sha256', TIKTOK_CLIENT_SECRET).update(cuerpo).digest('base64url')
  const a = Buffer.from(firma)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// Nunca se loguea el token: solo el mensaje y el log_id de TikTok.
async function tiktokApi(ruta, { accessToken, metodo = 'POST', body, query } = {}) {
  const url = new URL(`${TIKTOK_API}/${ruta.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, String(v))
  const response = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(metodo === 'POST' ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  const codigo = data.error?.code
  if (!response.ok || (codigo && codigo !== 'ok')) {
    throw new TikTokApiError(data.error?.message || `TikTok respondió ${response.status}`, {
      status: response.status, code: codigo, logId: data.error?.log_id,
    })
  }
  return data.data || {}
}

// /oauth/token/ (canje y renovación) y /oauth/revoke/: formulario, no JSON.
async function tiktokOAuth(ruta, campos) {
  const response = await fetch(`${TIKTOK_API}/oauth/${ruta}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: TIKTOK_CLIENT_KEY, client_secret: TIKTOK_CLIENT_SECRET, ...campos }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) {
    throw new TikTokApiError(data.error_description || data.error || `TikTok respondió ${response.status}`, {
      status: response.status, code: data.error, logId: data.log_id,
    })
  }
  return data
}

const permisosDe = (scope) => String(scope || '').split(',').map(p => p.trim()).filter(Boolean)

// refreshAnterior: si la renovación no trae refresh token nuevo, sigue valiendo el de antes.
async function guardarTokensTikTok(clienteId, datos, refreshAnterior = null) {
  const ahora = new Date().toISOString()
  const fila = {
    cliente_id: clienteId,
    access_token: datos.access_token,
    refresh_token: datos.refresh_token || refreshAnterior,
    expira_en: expiraEnDesde(Number(datos.expires_in) || null),
    refresh_expira_en: expiraEnDesde(Number(datos.refresh_expires_in) || null),
    actualizado_en: ahora,
  }
  const { error } = await supabaseAdmin.from('tiktok_tokens').upsert(fila, { onConflict: 'cliente_id' })
  if (error) throw error
  return fila
}

async function marcarConexionTikTok(clienteId, campos) {
  const { error } = await supabaseAdmin.from('tiktok_conexiones').update(campos).eq('cliente_id', clienteId)
  if (error) console.error('[tiktok] error actualizando la conexión:', error.message)
}

async function conexionTikTok(clienteId) {
  const { data } = await supabaseAdmin.from('tiktok_conexiones').select('*').eq('cliente_id', clienteId).maybeSingle()
  return data || null
}

// El refresh token rota: dos renovaciones a la vez del mismo cliente
// invalidarían una de las dos. Se comparte la promesa en curso.
const renovacionesTikTok = new Map()

// Access token válido (renovado si le queda menos de 1 h) o null. Si TikTok
// no deja renovar, la conexión pasa a "caducada" y hay que reconectar.
async function tokenTikTokVigente(clienteId) {
  const { data: fila, error } = await supabaseAdmin.from('tiktok_tokens')
    .select('access_token, refresh_token, expira_en').eq('cliente_id', clienteId).maybeSingle()
  if (error) throw new Error('No se pudo leer la conexión de TikTok')
  if (!fila) return null
  const quedaMs = fila.expira_en ? new Date(fila.expira_en).getTime() - Date.now() : Infinity
  if (quedaMs > TIKTOK_REFRESCAR_ANTES_MS) return fila.access_token

  if (!renovacionesTikTok.has(clienteId)) {
    const promesa = (async () => {
      try {
        const datos = await tiktokOAuth('token', { grant_type: 'refresh_token', refresh_token: fila.refresh_token })
        const guardado = await guardarTokensTikTok(clienteId, datos, fila.refresh_token)
        await marcarConexionTikTok(clienteId, {
          token_expira_en: guardado.expira_en, estado: 'activa', ultimo_error: null,
          ...(datos.scope ? { permisos: permisosDe(datos.scope) } : {}),
        })
        return guardado.access_token
      } catch (err) {
        console.error('[tiktok] no se pudo renovar el token:', err.message)
        // Un 5xx de TikTok es un fallo suyo, no un permiso revocado.
        if (err instanceof TikTokApiError && !(err.status >= 500)) {
          await marcarConexionTikTok(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de TikTok caducó o se revocó' })
          return null
        }
        // Fallo de red: si el token aún no ha caducado, se sigue usando.
        return quedaMs > 0 ? fila.access_token : null
      } finally {
        renovacionesTikTok.delete(clienteId)
      }
    })()
    renovacionesTikTok.set(clienteId, promesa)
  }
  return renovacionesTikTok.get(clienteId)
}

// Mismo esquema que Instagram: sesión (requireAuth va antes) y cliente
// accesible.
function requireClienteTikTok() {
  return async (req, res, next) => {
    if (!supabaseAdmin) return res.status(503).json({ error: 'TikTok no está disponible en el servidor' })
    const clienteId = req.params.clienteId || req.query.clienteId
    const { cliente } = await accesoClienteInstagram(clienteId, req.userId)
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    req.clienteTikTok = cliente
    next()
  }
}

// 1) URL de autorización de TikTok para este cliente.
app.get('/api/tiktok/conectar', requireAuth, requireClienteTikTok(), (req, res) => {
  if (!tiktokConfigurado()) {
    return res.status(503).json({ error: 'La conexión con TikTok todavía no está configurada', codigo: 'no_configurado' })
  }
  const state = firmarCargaTikTok({ c: req.clienteTikTok.id, u: req.userId, exp: Date.now() + TIKTOK_STATE_TTL_MS })
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', TIKTOK_CLIENT_KEY)
  url.searchParams.set('scope', TIKTOK_SCOPES)
  url.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  res.json({ url: url.toString() })
})

// 2) TikTok vuelve aquí tras autorizar (la identidad viaja en el state
// firmado). Redirige siempre a /clientes/:id?tiktok=conectado|error&motivo=
app.get('/api/tiktok/callback', async (req, res) => {
  const payload = leerCargaTikTok(req.query.state)
  const clienteId = payload?.c
  const volver = (params) => res.redirect(instagramRedirectFrontend(clienteId, params))

  if (req.query.error) return volver({ tiktok: 'error', motivo: req.query.error === 'access_denied' ? 'cancelado' : 'error' })
  if (!payload) return volver({ tiktok: 'error', motivo: 'enlace_caducado' })
  if (!tiktokConfigurado()) return volver({ tiktok: 'error', motivo: 'no_configurado' })
  const code = String(req.query.code || '')
  if (!code) return volver({ tiktok: 'error', motivo: 'error' })

  try {
    const { cliente } = await accesoClienteInstagram(clienteId, payload.u)
    if (!cliente) return volver({ tiktok: 'error', motivo: 'cliente' })

    const datos = await tiktokOAuth('token', { grant_type: 'authorization_code', code, redirect_uri: TIKTOK_REDIRECT_URI })
    // El usuario puede desmarcar permisos al autorizar: se guardan los concedidos.
    const permisos = permisosDe(datos.scope)
    const campos = ['open_id', 'avatar_url', 'display_name', ...(permisos.includes('user.info.profile') ? ['username'] : [])]
    const { user = {} } = await tiktokApi('user/info/', { accessToken: datos.access_token, metodo: 'GET', query: { fields: campos.join(',') } })
      .catch(err => { console.error('[tiktok] no se pudo leer el perfil:', err.message); return {} })

    const { error: errorConexion } = await supabaseAdmin.from('tiktok_conexiones').upsert({
      cliente_id: clienteId,
      open_id: String(user.open_id || datos.open_id),
      username: user.username || null,
      nombre: user.display_name || null,
      avatar_url: user.avatar_url || null,
      permisos,
      conectado_por: payload.u,
      conectado_en: new Date().toISOString(),
      token_expira_en: expiraEnDesde(Number(datos.expires_in) || null),
      estado: 'activa',
      ultimo_error: null,
    }, { onConflict: 'cliente_id' })
    if (errorConexion) throw errorConexion
    await guardarTokensTikTok(clienteId, datos)
    volver({ tiktok: 'conectado' })
  } catch (err) {
    console.error('[tiktok] error en el callback:', err.message)
    volver({ tiktok: 'error', motivo: 'error' })
  }
})

// 3) Estado de la conexión (sin tokens). No exige plan, para poder explicar
// en la interfaz por qué no se puede conectar.
app.get('/api/tiktok/estado/:clienteId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('tiktok_conexiones').select('*').eq('cliente_id', req.clienteTikTok.id).maybeSingle()
  if (error && !esTablaTikTokInexistente(error)) return res.status(500).json({ error: 'No se pudo consultar la conexión de TikTok' })
  res.json({
    configurado: tiktokConfigurado() && !error,
    conectado: data?.estado === 'activa',
    conexion: data ? {
      username: data.username,
      nombre: data.nombre,
      avatar_url: data.avatar_url,
      conectado_en: data.conectado_en,
      token_expira_en: data.token_expira_en,
      estado: data.estado,
      ultimo_error: data.ultimo_error,
      permisos: data.permisos || [],
    } : null,
  })
})

// 4) Desconectar: revoca en TikTok (si se puede) y borra token, conexión y métricas.
// Las publicaciones se quedan (historial del calendario).
app.delete('/api/tiktok/conexion/:clienteId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const clienteId = req.clienteTikTok.id
  const { data: tokens } = await supabaseAdmin.from('tiktok_tokens').select('access_token').eq('cliente_id', clienteId).maybeSingle()
  if (tokens?.access_token && tiktokConfigurado()) {
    await tiktokOAuth('revoke', { token: tokens.access_token }).catch(err => console.warn('[tiktok] no se pudo revocar el token:', err.message))
  }
  const resultados = await Promise.all([
    supabaseAdmin.from('tiktok_tokens').delete().eq('cliente_id', clienteId),
    supabaseAdmin.from('tiktok_conexiones').delete().eq('cliente_id', clienteId),
  ])
  if (resultados.some(r => r.error)) return res.status(500).json({ error: 'No se pudo desconectar TikTok' })
  // Las métricas guardadas (0050) se van con la cuenta. Sin la migración no hay nada que borrar.
  await Promise.all(['tiktok_metricas_cache', 'tiktok_metricas_dia', 'tiktok_videos_24h']
    .map(tabla => supabaseAdmin.from(tabla).delete().eq('cliente_id', clienteId)))
  res.json({ ok: true })
})

// Errores de TikTok que tienen arreglo por parte del usuario, en castellano.
const ERRORES_TIKTOK = {
  spam_risk_too_many_posts: 'La cuenta ha llegado al límite de publicaciones diarias de TikTok. Prueba mañana.',
  spam_risk_user_banned_from_posting: 'TikTok no deja publicar a esta cuenta ahora mismo.',
  reached_active_user_cap: 'Aify ha llegado al límite diario de cuentas que pueden publicar en TikTok. Prueba mañana.',
  unaudited_client_can_only_post_to_private_accounts: 'Hasta que TikTok apruebe la auditoría de Aify, solo se puede publicar como «Solo yo» y en cuentas privadas.',
  privacy_level_option_mismatch: 'La privacidad elegida ya no está disponible para esta cuenta. Vuelve a programarlo eligiendo otra.',
  url_ownership_unverified: 'TikTok no reconoce el dominio de los archivos: falta verificar el prefijo en TikTok for Developers.',
  scope_not_authorized: 'La cuenta no dio permiso para publicar. Vuelve a conectar TikTok aceptando todos los permisos.',
  access_token_invalid: 'El permiso de TikTok caducó o se revocó. Vuelve a conectar la cuenta.',
  rate_limit_exceeded: 'TikTok ha recibido demasiadas peticiones seguidas. Se reintentará en unos minutos.',
}

// fail_reason de status/fetch y de los webhooks.
const MOTIVOS_FALLO_TIKTOK = {
  file_format_check_failed: 'el formato del archivo no es válido para TikTok',
  duration_check_failed: 'el vídeo es más largo o más corto de lo que permite la cuenta',
  frame_rate_check_failed: 'los fotogramas por segundo del vídeo no son válidos',
  picture_size_check_failed: 'el tamaño de la imagen no es válido (máximo 1080 px)',
  video_pull_failed: 'TikTok no pudo descargar el vídeo',
  photo_pull_failed: 'TikTok no pudo descargar las fotos',
  publish_cancelled: 'se canceló la publicación',
  auth_removed: 'la cuenta quitó el permiso a Aify',
  spam_risk_too_many_posts: 'la cuenta ha llegado al límite de publicaciones diarias',
  spam_risk_user_banned_from_posting: 'TikTok no deja publicar a esta cuenta ahora mismo',
  spam_risk_text: 'TikTok ha considerado el texto como spam',
  spam_risk: 'TikTok lo ha considerado spam',
  internal: 'error interno de TikTok',
}

const mensajeErrorTikTok = (err) => ERRORES_TIKTOK[err?.code] || err?.message || 'error desconocido'
const motivoFalloTikTok = (motivo) => MOTIVOS_FALLO_TIKTOK[motivo] || motivo || 'motivo desconocido'

function creadorParaCliente(datos) {
  return {
    nombre: datos.creator_nickname || null,
    usuario: datos.creator_username || null,
    avatar: datos.creator_avatar_url || null,
    opcionesPrivacidad: Array.isArray(datos.privacy_level_options) ? datos.privacy_level_options : [],
    comentariosDesactivados: Boolean(datos.comment_disabled),
    duoDesactivado: Boolean(datos.duet_disabled),
    stitchDesactivado: Boolean(datos.stitch_disabled),
    duracionMaxSeg: Number(datos.max_video_post_duration_sec) || null,
  }
}

// 5) Datos del creador para el formulario de publicar (TikTok exige pedirlos
// cada vez que se abre): nombre, privacidades, interacciones y duración máxima.
// También lo usa el MCP (ver_creador_tiktok y programar_tiktok).
async function creadorTikTok(clienteId) {
  const accessToken = await tokenTikTokVigente(clienteId).catch(() => null)
  if (!accessToken) return { estado: 409, error: 'Conecta (o vuelve a conectar) el TikTok de este cliente.', codigo: 'reconectar' }
  try {
    const datos = await tiktokApi('post/publish/creator_info/query/', { accessToken })
    return { creador: { ...creadorParaCliente(datos), soloPrivado: !TIKTOK_AUDITADA } }
  } catch (err) {
    if (tokenTikTokInvalido(err)) {
      await marcarConexionTikTok(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de TikTok caducó o se revocó' })
      return { estado: 409, error: ERRORES_TIKTOK.access_token_invalid, codigo: 'reconectar' }
    }
    const noPuede = ['spam_risk_too_many_posts', 'spam_risk_user_banned_from_posting', 'reached_active_user_cap'].includes(err.code)
    console.error('[tiktok] creator_info:', err.code, err.message, err.logId || '')
    return { estado: noPuede ? 409 : 502, error: mensajeErrorTikTok(err), codigo: noPuede ? 'no_puede_publicar' : err.code || null }
  }
}

app.get('/api/tiktok/creador/:clienteId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const resultado = await creadorTikTok(req.clienteTikTok.id)
  if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error, codigo: resultado.codigo })
  res.json(resultado.creador)
})

// URL pública (con caducidad) de un archivo del bucket para que TikTok lo
// descargue. La extensión ayuda a TikTok a reconocer el tipo.
function urlMedioTikTok(ruta) {
  const ext = (/\.([a-z0-9]{2,4})$/i.exec(ruta)?.[1] || 'bin').toLowerCase()
  return `${TIKTOK_MEDIOS_BASE_URL}/api/tiktok/medios/${firmarCargaTikTok({ r: ruta, exp: Date.now() + TIKTOK_MEDIOS_TTL_MS })}.${ext}`
}

const TIPOS_MIME_MEDIOS = { mp4: 'video/mp4', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

// 6) Archivos para TikTok (PULL_FROM_URL) y el archivo de verificación del
// prefijo. Sin redirecciones (TikTok no las sigue): se sirve el archivo tal
// cual desde Storage, con su tamaño, y se respetan los Range.
app.get('/api/tiktok/medios/:archivo', async (req, res) => {
  const { archivo } = req.params
  if (TIKTOK_VERIFICACION_ARCHIVO && archivo === TIKTOK_VERIFICACION_ARCHIVO) {
    res.type('text/plain')
    return res.send(TIKTOK_VERIFICACION_CONTENIDO || '')
  }
  const codigoVerificacion = /^tiktok([A-Za-z0-9]+)\.txt$/.exec(archivo)?.[1]
  if (codigoVerificacion && TIKTOK_VERIFICACION_CODIGOS.has(codigoVerificacion)) {
    res.type('text/plain')
    return res.send(`tiktok-developers-site-verification=${codigoVerificacion}`)
  }
  const [cuerpo, firma] = archivo.split('.')
  const datos = leerCargaTikTok(`${cuerpo}.${firma}`)
  if (!datos?.r || !supabaseAdmin) return res.sendStatus(404)

  try {
    const { data: firmada, error } = await supabaseAdmin.storage.from(BUCKET_PUBLICACIONES).createSignedUrl(datos.r, 10 * 60)
    if (error || !firmada?.signedUrl) return res.sendStatus(404)
    const origen = await fetch(firmada.signedUrl, { headers: req.headers.range ? { Range: req.headers.range } : {} })
    if (!origen.ok || !origen.body) return res.sendStatus(origen.status === 416 ? 416 : 404)
    const ext = (/\.([a-z0-9]{2,4})$/i.exec(datos.r)?.[1] || '').toLowerCase()
    res.status(origen.status)
    res.setHeader('Content-Type', TIPOS_MIME_MEDIOS[ext] || origen.headers.get('content-type') || 'application/octet-stream')
    for (const cabecera of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const valor = origen.headers.get(cabecera)
      if (valor) res.setHeader(cabecera, valor)
    }
    res.setHeader('Cache-Control', 'private, max-age=600')
    if (req.method === 'HEAD') return res.end()
    Readable.fromWeb(origen.body).pipe(res)
  } catch (err) {
    console.error('[tiktok] error sirviendo un archivo:', err.message)
    if (!res.headersSent) res.sendStatus(502)
  }
})

// ── Publicar en TikTok ──

const CAMPOS_PUBLICACION_TIKTOK = [
  'id', 'post_id', 'tipo', 'archivos', 'titulo', 'descripcion', 'privacidad',
  'permitir_comentarios', 'permitir_duo', 'permitir_stitch',
  'contenido_comercial', 'marca_propia', 'contenido_de_marca', 'es_ia', 'musica_auto',
  'portada_ms', 'portada_indice', 'consentimiento_en', 'publicar_en', 'estado', 'estado_tiktok',
  'tiktok_post_id', 'enlace', 'publicado_en', 'error', 'archivos_borrados', 'actualizado_en',
]

function publicacionTikTokParaCliente(fila) {
  if (!fila) return fila
  return Object.fromEntries(CAMPOS_PUBLICACION_TIKTOK.map(c => [c, fila[c] ?? null]))
}

function validarPublicacionTikTok(body, prefijo) {
  const tipo = body.tipo
  if (!TIPOS_TIKTOK.includes(tipo)) return 'Tipo de publicación no válido'
  const archivos = Array.isArray(body.archivos) ? body.archivos : []
  if (archivos.some(a => !a || typeof a.ruta !== 'string' || !a.ruta.startsWith(prefijo) || !['imagen', 'video'].includes(a.tipo)
    || (a.nombre != null && (typeof a.nombre !== 'string' || a.nombre.length > 255))
    || (a.bytes != null && !Number.isFinite(a.bytes)))) {
    return 'Archivo no válido'
  }
  if (tipo === 'video' && (archivos.length !== 1 || archivos[0].tipo !== 'video')) return 'Un vídeo de TikTok lleva un solo vídeo'
  if (tipo === 'fotos' && (archivos.length < 1 || archivos.length > TIKTOK_MAX_FOTOS || archivos.some(a => a.tipo !== 'imagen'))) {
    return `Una publicación de fotos lleva entre 1 y ${TIKTOK_MAX_FOTOS} imágenes`
  }
  const titulo = String(body.titulo || '')
  if (tipo === 'video' && titulo.length > TIKTOK_MAX_TITULO_VIDEO) return `El texto admite como mucho ${TIKTOK_MAX_TITULO_VIDEO} caracteres`
  if (tipo === 'fotos' && titulo.length > TIKTOK_MAX_TITULO_FOTOS) return `El título admite como mucho ${TIKTOK_MAX_TITULO_FOTOS} caracteres`
  if (String(body.descripcion || '').length > TIKTOK_MAX_DESCRIPCION_FOTOS) return `La descripción admite como mucho ${TIKTOK_MAX_DESCRIPCION_FOTOS} caracteres`
  // TikTok no deja dar privacidad por defecto: tiene que elegirla el usuario.
  if (!PRIVACIDADES_TIKTOK.includes(body.privacidad)) return 'Elige quién puede ver la publicación'
  if (!TIKTOK_AUDITADA && body.privacidad !== 'SELF_ONLY') return 'Hasta que TikTok apruebe la auditoría de Aify, solo se puede publicar como «Solo yo»'
  if (body.contenidoComercial && !body.marcaPropia && !body.contenidoDeMarca) return 'Indica si el contenido promociona tu marca, la de un tercero o ambas'
  if (body.contenidoComercial && body.contenidoDeMarca && body.privacidad === 'SELF_ONLY') return 'El contenido de marca no puede publicarse como «Solo yo»'
  if (body.portadaMs != null && (!Number.isInteger(body.portadaMs) || body.portadaMs < 0)) return 'Portada no válida'
  if (body.portadaIndice != null && (!Number.isInteger(body.portadaIndice) || body.portadaIndice < 0 || body.portadaIndice >= archivos.length)) return 'Portada no válida'
  if (body.consentimiento !== true) return 'Falta aceptar las condiciones de TikTok'
  if (Number.isNaN(new Date(body.publicarEn).getTime())) return 'Fecha de publicación no válida'
  return null
}

app.get('/api/tiktok/publicar/:clienteId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const clienteId = req.clienteTikTok.id
  const [{ data: conexion, error: errorConexion }, { data, error }] = await Promise.all([
    supabaseAdmin.from('tiktok_conexiones').select('*').eq('cliente_id', clienteId).maybeSingle(),
    supabaseAdmin.from('tiktok_publicaciones').select('*').eq('cliente_id', clienteId).order('publicar_en', { ascending: false }).limit(200),
  ])
  if (esTablaTikTokInexistente(error) || esTablaTikTokInexistente(errorConexion)) {
    return res.status(500).json({ error: 'Para publicar en TikTok falta aplicar la migración 0049.' })
  }
  if (error) return res.status(500).json({ error: 'No se pudieron leer las publicaciones de TikTok' })
  res.json({
    configurado: tiktokConfigurado(),
    conectado: conexion?.estado === 'activa',
    permisosOk: Array.isArray(conexion?.permisos) && conexion.permisos.includes(PERMISO_PUBLICAR_TIKTOK),
    auditada: TIKTOK_AUDITADA,
    publicaciones: (data || []).map(publicacionTikTokParaCliente),
  })
})

// Programa (o reprograma) un post del calendario en TikTok. Guarda todo lo que
// eligió el usuario en el formulario (TikTok exige que lo elija él).
async function programarPublicacionTikTok({ clienteId, organizacionId, postId, body, userId }) {
  const prefijo = `${organizacionId}/${clienteId}/`
  const error = validarPublicacionTikTok(body || {}, prefijo)
  if (error) return { estado: 400, error }

  const { data: post } = await supabaseAdmin.from('calendario_posts').select('id').eq('id', postId).eq('cliente_id', clienteId).maybeSingle()
  if (!post) return { estado: 404, error: 'Post no encontrado' }
  const { data: actual } = await supabaseAdmin.from('tiktok_publicaciones').select('*').eq('post_id', post.id).maybeSingle()
  if (actual && ['procesando', 'publicado'].includes(actual.estado)) {
    return { estado: 409, error: actual.estado === 'publicado' ? 'Este post ya está publicado en TikTok' : 'Este post se está publicando en TikTok ahora mismo' }
  }

  const video = body.tipo === 'video'
  const comercial = Boolean(body.contenidoComercial)
  const { data, error: errorDb } = await supabaseAdmin.from('tiktok_publicaciones').upsert({
    cliente_id: clienteId,
    post_id: post.id,
    tipo: body.tipo,
    archivos: body.archivos.map(a => ({ ruta: a.ruta, tipo: a.tipo, ...(a.nombre ? { nombre: a.nombre } : {}), ...(a.bytes ? { bytes: a.bytes } : {}) })),
    titulo: String(body.titulo || ''),
    descripcion: video ? null : String(body.descripcion || ''),
    privacidad: body.privacidad,
    permitir_comentarios: Boolean(body.permitirComentarios),
    permitir_duo: video && Boolean(body.permitirDuo),
    permitir_stitch: video && Boolean(body.permitirStitch),
    contenido_comercial: comercial,
    marca_propia: comercial && Boolean(body.marcaPropia),
    contenido_de_marca: comercial && Boolean(body.contenidoDeMarca),
    es_ia: video && Boolean(body.esIa),
    musica_auto: !video && Boolean(body.musicaAuto),
    portada_ms: video && body.portadaMs != null ? body.portadaMs : null,
    portada_indice: !video ? body.portadaIndice ?? 0 : null,
    consentimiento_en: new Date().toISOString(),
    publicar_en: new Date(body.publicarEn).toISOString(),
    estado: 'programado',
    estado_tiktok: null,
    publish_id: null,
    procesando_desde: null,
    error: null,
    intentos: 0,
    creado_por: userId,
    actualizado_en: new Date().toISOString(),
  }, { onConflict: 'post_id' }).select('*').single()
  if (errorDb) {
    return { estado: 500, error: esTablaTikTokInexistente(errorDb) ? 'Para publicar en TikTok falta aplicar la migración 0049.' : 'No se pudo programar la publicación en TikTok' }
  }
  if (actual) {
    const nuevas = new Set(rutasDePublicacion(data))
    borrarArchivosSinUso(rutasDePublicacion(actual).filter(r => !nuevas.has(r)))
      .catch(err => console.error('[storage] no se pudo borrar el archivo sustituido:', err.message))
  }
  return { publicacion: publicacionTikTokParaCliente(data) }
}

app.put('/api/tiktok/publicar/:clienteId/:postId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const organizacion = await obtenerOrganizacionDelUsuario(req.userId)
  const resultado = await programarPublicacionTikTok({
    clienteId: req.clienteTikTok.id,
    organizacionId: organizacion?.id,
    postId: req.params.postId,
    body: req.body,
    userId: req.userId,
  })
  if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error })
  res.json({ publicacion: resultado.publicacion })
})

// Mover de día u hora en el calendario lo ya programado, sin tocar lo que el
// usuario eligió (privacidad, consentimiento…).
// También lo usa el MCP (mover_post).
async function moverPublicacionTikTok({ clienteId, postId, publicarEn }) {
  const fecha = new Date(publicarEn)
  if (Number.isNaN(fecha.getTime())) return { estado: 400, error: 'Fecha de publicación no válida' }
  const { data, error } = await supabaseAdmin.from('tiktok_publicaciones')
    .update({ publicar_en: fecha.toISOString(), actualizado_en: new Date().toISOString() })
    .eq('post_id', postId).eq('cliente_id', clienteId).eq('estado', 'programado')
    .select('*').maybeSingle()
  if (error) return { estado: 500, error: 'No se pudo cambiar la hora de TikTok' }
  if (!data) return { estado: 409, error: 'Solo se puede mover una publicación programada' }
  return { publicacion: publicacionTikTokParaCliente(data) }
}

app.patch('/api/tiktok/publicar/:clienteId/:postId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const resultado = await moverPublicacionTikTok({ clienteId: req.clienteTikTok.id, postId: req.params.postId, publicarEn: req.body?.publicarEn })
  if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error })
  res.json({ publicacion: resultado.publicacion })
})

app.delete('/api/tiktok/publicar/:clienteId/:postId', requireAuth, requireClienteTikTok(), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('tiktok_publicaciones')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('post_id', req.params.postId).eq('cliente_id', req.clienteTikTok.id).in('estado', ['programado', 'error'])
    .select('*').maybeSingle()
  if (error) return res.status(500).json({ error: 'No se pudo cancelar' })
  if (!data) return res.status(409).json({ error: 'Solo se puede cancelar una publicación programada o con error' })
  res.json({ publicacion: publicacionTikTokParaCliente(data) })
})

async function actualizarPublicacionTikTok(id, campos) {
  const { error } = await supabaseAdmin.from('tiktok_publicaciones')
    .update({ ...campos, actualizado_en: new Date().toISOString() }).eq('id', id)
  if (error) console.error('[tiktok] error actualizando la publicación:', error.message)
}

async function falloPublicacionTikTok(pub, mensaje, err) {
  console.error('[tiktok] publicación fallida', pub.id, ':', err ? `${err.code || ''} ${err.message} ${err.logId || ''}` : mensaje)
  await actualizarPublicacionTikTok(pub.id, { estado: 'error', error: String(mensaje).slice(0, 300) })
  if (err && tokenTikTokInvalido(err)) {
    await marcarConexionTikTok(pub.cliente_id, { estado: 'caducada', ultimo_error: 'El permiso de TikTok caducó o se revocó' })
  }
}

const enlaceTikTok = (username, postId) => (username && postId ? `https://www.tiktok.com/@${username}/video/${postId}` : null)

// Paso 1: comprueba de nuevo el creador (TikTok lo exige justo antes) y
// manda el vídeo o las fotos con PULL_FROM_URL.
async function iniciarPublicacionTikTok(pub) {
  const conexion = await conexionTikTok(pub.cliente_id)
  const accessToken = conexion?.estado === 'activa' ? await tokenTikTokVigente(pub.cliente_id).catch(() => null) : null
  if (!accessToken) return falloPublicacionTikTok(pub, 'TikTok no está conectado o hay que reconectarlo')
  if (!conexion.permisos?.includes(PERMISO_PUBLICAR_TIKTOK)) {
    return falloPublicacionTikTok(pub, ERRORES_TIKTOK.scope_not_authorized)
  }

  let creador
  try {
    creador = creadorParaCliente(await tiktokApi('post/publish/creator_info/query/', { accessToken }))
  } catch (err) {
    if (err.code === 'rate_limit_exceeded') return reintentarTikTok(pub, ERRORES_TIKTOK.rate_limit_exceeded)
    return falloPublicacionTikTok(pub, `TikTok no deja publicar ahora: ${mensajeErrorTikTok(err)}`, err)
  }
  if (!creador.opcionesPrivacidad.includes(pub.privacidad)) {
    return falloPublicacionTikTok(pub, ERRORES_TIKTOK.privacy_level_option_mismatch)
  }

  // Lo que el creador tiene desactivado en TikTok no se puede activar desde aquí.
  const comun = {
    privacy_level: pub.privacidad,
    disable_comment: !pub.permitir_comentarios || creador.comentariosDesactivados,
    brand_content_toggle: Boolean(pub.contenido_comercial && pub.contenido_de_marca),
    brand_organic_toggle: Boolean(pub.contenido_comercial && pub.marca_propia),
  }
  try {
    let datos
    if (pub.tipo === 'video') {
      datos = await tiktokApi('post/publish/video/init/', {
        accessToken,
        body: {
          post_info: {
            ...comun,
            title: pub.titulo || '',
            disable_duet: !pub.permitir_duo || creador.duoDesactivado,
            disable_stitch: !pub.permitir_stitch || creador.stitchDesactivado,
            ...(pub.portada_ms != null ? { video_cover_timestamp_ms: pub.portada_ms } : {}),
            is_aigc: Boolean(pub.es_ia),
          },
          source_info: { source: 'PULL_FROM_URL', video_url: urlMedioTikTok(pub.archivos[0].ruta) },
        },
      })
    } else {
      datos = await tiktokApi('post/publish/content/init/', {
        accessToken,
        body: {
          post_info: {
            ...comun,
            title: pub.titulo || '',
            description: pub.descripcion || '',
            auto_add_music: Boolean(pub.musica_auto),
          },
          source_info: {
            source: 'PULL_FROM_URL',
            photo_cover_index: Math.min(pub.portada_indice || 0, pub.archivos.length - 1),
            photo_images: pub.archivos.map(a => urlMedioTikTok(a.ruta)),
          },
          post_mode: 'DIRECT_POST',
          media_type: 'PHOTO',
        },
      })
    }
    if (!datos.publish_id) throw new TikTokApiError('TikTok no devolvió el identificador de la publicación')
    await actualizarPublicacionTikTok(pub.id, { publish_id: datos.publish_id, estado_tiktok: 'PROCESSING_DOWNLOAD' })
  } catch (err) {
    if (err.code === 'rate_limit_exceeded') return reintentarTikTok(pub, ERRORES_TIKTOK.rate_limit_exceeded)
    await falloPublicacionTikTok(pub, `TikTok rechazó la publicación: ${mensajeErrorTikTok(err)}`, err)
  }
}

// Límite de peticiones por minuto: se vuelve a programar 5 minutos más tarde.
function reintentarTikTok(pub, mensaje) {
  return actualizarPublicacionTikTok(pub.id, {
    estado: 'programado', procesando_desde: null,
    publicar_en: new Date(Date.now() + 5 * 60 * 1000).toISOString(), error: mensaje,
  })
}

// Publicada en TikTok (por status/fetch o por el webhook). Solo la primera vez
// cierra el post del calendario, borra los archivos y mueve la tarea.
async function publicacionTikTokCompletada(pub, tiktokPostId) {
  const conexion = await conexionTikTok(pub.cliente_id)
  const { data: marcada } = await supabaseAdmin.from('tiktok_publicaciones').update({
    estado: 'publicado', estado_tiktok: 'PUBLISH_COMPLETE', error: null,
    publicado_en: new Date().toISOString(),
    tiktok_post_id: tiktokPostId || null,
    enlace: enlaceTikTok(conexion?.username, tiktokPostId),
    actualizado_en: new Date().toISOString(),
  }).eq('id', pub.id).eq('estado', 'procesando').select('*').maybeSingle()
  if (!marcada) return
  await supabaseAdmin.from('calendario_posts').update({ estado: 'publicado' }).eq('id', pub.post_id)
  if (await borrarArchivosSinUso(rutasDePublicacion(pub)).catch(err => console.error('[storage]', err.message))) {
    await actualizarPublicacionTikTok(pub.id, { archivos_borrados: true })
  }
  await cerrarTareaDelPost(pub.post_id, 'TikTok')
}

// Paso 2: pregunta a TikTok cómo va. Se llama en cada vuelta del ciclo
// mientras siga "procesando" (el webhook puede adelantarse).
async function avanzarPublicacionTikTok(pub) {
  if (pub.procesando_desde && Date.now() - new Date(pub.procesando_desde).getTime() > PUBLICAR_TIEMPO_MAX_MS) {
    return falloPublicacionTikTok(pub, 'TikTok tardó demasiado en procesar la publicación')
  }
  if (!pub.publish_id) return falloPublicacionTikTok(pub, 'No se llegó a enviar a TikTok. Vuelve a programarlo.')
  const accessToken = await tokenTikTokVigente(pub.cliente_id).catch(() => null)
  if (!accessToken) return falloPublicacionTikTok(pub, 'TikTok no está conectado o hay que reconectarlo')

  try {
    const datos = await tiktokApi('post/publish/status/fetch/', { accessToken, body: { publish_id: pub.publish_id } })
    const estado = datos.status
    if (estado === 'PUBLISH_COMPLETE') return publicacionTikTokCompletada(pub, datos.publicaly_available_post_id?.[0])
    if (estado === 'FAILED') return falloPublicacionTikTok(pub, `TikTok no pudo publicarlo: ${motivoFalloTikTok(datos.fail_reason)}`)
    if (estado === 'SEND_TO_USER_INBOX') {
      return falloPublicacionTikTok(pub, 'TikTok lo ha dejado en la bandeja de la app en vez de publicarlo: termínalo desde TikTok.')
    }
    if (estado && estado !== pub.estado_tiktok) await actualizarPublicacionTikTok(pub.id, { estado_tiktok: estado })
  } catch (err) {
    if (err.code === 'rate_limit_exceeded') return
    await falloPublicacionTikTok(pub, `TikTok no respondió sobre la publicación: ${mensajeErrorTikTok(err)}`, err)
  }
}

let cicloPublicacionesTikTokEnCurso = false
async function cicloPublicacionesTikTok() {
  if (cicloPublicacionesTikTokEnCurso || !tiktokConfigurado()) return
  cicloPublicacionesTikTokEnCurso = true
  try {
    const ahora = new Date().toISOString()
    const { data: tocan, error } = await supabaseAdmin.from('tiktok_publicaciones')
      .select('*').eq('estado', 'programado').lte('publicar_en', ahora).order('publicar_en').limit(10)
    if (error) {
      if (!esTablaTikTokInexistente(error)) console.error('[tiktok] error leyendo publicaciones:', error.message)
      return
    }
    for (const pub of tocan || []) {
      // Reserva atómica, como en Instagram: si otra vuelta ya la cogió, no devuelve fila.
      const { data: reservada } = await supabaseAdmin.from('tiktok_publicaciones')
        .update({ estado: 'procesando', procesando_desde: ahora, intentos: pub.intentos + 1, error: null, actualizado_en: ahora })
        .eq('id', pub.id).eq('estado', 'programado').select('*').maybeSingle()
      if (reservada) await iniciarPublicacionTikTok(reservada)
    }

    const { data: enCurso } = await supabaseAdmin.from('tiktok_publicaciones')
      .select('*').eq('estado', 'procesando').lt('procesando_desde', ahora).limit(20)
    for (const pub of enCurso || []) await avanzarPublicacionTikTok(pub)
  } catch (err) {
    console.error('[tiktok] error en el ciclo de publicaciones:', err.message)
  } finally {
    cicloPublicacionesTikTokEnCurso = false
  }
}

if (supabaseAdmin) setInterval(cicloPublicacionesTikTok, PUBLICAR_INTERVALO_MS)

// ── Webhook de TikTok ──
// Cabecera TikTok-Signature: t=<segundos>,s=<hex HMAC-SHA256 de "t.cuerpo"
// con el client secret>. Se rechaza si tiene más de 5 minutos.
function firmaWebhookTikTokValida(req) {
  const partes = Object.fromEntries(String(req.headers['tiktok-signature'] || '').split(',').map(p => {
    const i = p.indexOf('=')
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
  }))
  const t = Number(partes.t)
  if (!partes.s || !Number.isFinite(t) || !req.rawBody || !TIKTOK_CLIENT_SECRET) return false
  if (Math.abs(Date.now() / 1000 - t) > TIKTOK_WEBHOOK_TOLERANCIA_S) return false
  const esperada = Buffer.from(crypto.createHmac('sha256', TIKTOK_CLIENT_SECRET)
    .update(Buffer.concat([Buffer.from(`${partes.t}.`), req.rawBody])).digest('hex'))
  const recibida = Buffer.from(partes.s)
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada)
}

async function procesarEventoTikTok(evento) {
  let contenido = evento.content
  if (typeof contenido === 'string') {
    try { contenido = JSON.parse(contenido) } catch { contenido = {} }
  }
  contenido ||= {}

  if (evento.event === 'authorization.removed') {
    const { data: conexiones } = await supabaseAdmin.from('tiktok_conexiones').select('cliente_id').eq('open_id', String(evento.user_openid || ''))
    const clientes = (conexiones || []).map(c => c.cliente_id)
    if (!clientes.length) return
    await supabaseAdmin.from('tiktok_tokens').delete().in('cliente_id', clientes)
    await supabaseAdmin.from('tiktok_conexiones').update({ estado: 'caducada', ultimo_error: 'Se quitó el permiso a Aify desde TikTok' }).in('cliente_id', clientes)
    return
  }

  if (!String(evento.event || '').startsWith('post.publish.') || !contenido.publish_id) return
  const { data: pub } = await supabaseAdmin.from('tiktok_publicaciones').select('*').eq('publish_id', String(contenido.publish_id)).maybeSingle()
  if (!pub) return

  switch (evento.event) {
    case 'post.publish.complete':
      if (pub.estado === 'procesando') await publicacionTikTokCompletada(pub, contenido.post_id)
      break
    case 'post.publish.publicly_available': {
      if (pub.estado === 'procesando') await publicacionTikTokCompletada(pub, contenido.post_id)
      else if (pub.estado === 'publicado' && contenido.post_id && !pub.tiktok_post_id) {
        const conexion = await conexionTikTok(pub.cliente_id)
        await actualizarPublicacionTikTok(pub.id, { tiktok_post_id: String(contenido.post_id), enlace: enlaceTikTok(conexion?.username, contenido.post_id) })
      }
      break
    }
    case 'post.publish.no_longer_publicaly_available':
      await actualizarPublicacionTikTok(pub.id, { estado_tiktok: 'NO_PUBLICO' })
      break
    case 'post.publish.failed':
      if (pub.estado === 'procesando') await falloPublicacionTikTok(pub, `TikTok no pudo publicarlo: ${motivoFalloTikTok(contenido.reason)}`)
      break
    case 'post.publish.inbox_delivered':
      if (pub.estado === 'procesando') await falloPublicacionTikTok(pub, 'TikTok lo ha dejado en la bandeja de la app en vez de publicarlo: termínalo desde TikTok.')
      break
    default:
      break
  }
}

// Se responde 200 enseguida (TikTok reintenta si tarda) y se procesa después.
// Todo es idempotente: un evento repetido no vuelve a cerrar nada.
app.post('/api/tiktok/webhook', (req, res) => {
  if (!supabaseAdmin || !firmaWebhookTikTokValida(req)) {
    console.warn('[tiktok] webhook rechazado: firma no válida', req.headers['tiktok-signature'] ? '(con cabecera)' : '(sin cabecera)')
    return res.sendStatus(401)
  }
  res.sendStatus(200)
  const evento = req.body || {}
  if (evento.client_key && evento.client_key !== TIKTOK_CLIENT_KEY) return
  console.log(`[tiktok] webhook recibido: ${evento.event || '—'}`)
  procesarEventoTikTok(evento).catch(err => console.error('[tiktok] error procesando el webhook:', err.message))
})

// ─── TikTok: métricas (fase 2) ───────────────────────────────────────────────
//
// Lo que da la API de TikTok (docs/tiktok-plan.md): contadores de la cuenta
// (user/info, scope user.info.stats) y, por vídeo público, visualizaciones,
// me gustas, comentarios y compartidos (video/list, scope video.list). Ni
// alcance, ni retención, ni series diarias: la evolución se construye con una
// foto diaria de los contadores (tiktok_metricas_dia, 0050). Todo se escribe
// con la service role.

const PERMISOS_METRICAS_TIKTOK = ['user.info.stats', 'video.list']
const TIKTOK_CAMPOS_VIDEO = 'id,create_time,cover_image_url,share_url,video_description,duration,title,like_count,comment_count,share_count,view_count'
const TIKTOK_VIDEOS_POR_PAGINA = 20 // máximo de video/list
const TIKTOK_MAX_VIDEOS_METRICAS = 60
// La foto diaria suma las visualizaciones de los vídeos listados: cuantos más,
// menos se nota que un vídeo antiguo salga de la lista. Una vez al día.
const TIKTOK_MAX_VIDEOS_FOTO = 200
const TIKTOK_CACHE_TTL_MS = INSTAGRAM_CACHE_TTL_MS
const TIKTOK_REFRESCO_MIN_MS = INSTAGRAM_REFRESCO_MIN_MS
const MENSAJE_PERMISOS_METRICAS_TIKTOK = 'La cuenta no dio permiso para leer sus estadísticas y sus vídeos. Vuelve a conectar TikTok aceptando todos los permisos.'

const tienePermisosMetricasTikTok = (conexion) => PERMISOS_METRICAS_TIKTOK.every(p => (conexion?.permisos || []).includes(p))
const diaUtc = (fecha = new Date()) => fecha.toISOString().slice(0, 10)
const sumaVisualizaciones = (videos) => videos.reduce((total, v) => total + (Number(v.visualizaciones) || 0), 0)

// Vídeos públicos de la cuenta, del más reciente al más antiguo, paginando de 20 en 20.
async function listarVideosTikTok(accessToken, max = TIKTOK_MAX_VIDEOS_METRICAS) {
  const videos = []
  let cursor
  while (videos.length < max) {
    const datos = await tiktokApi('video/list/', {
      accessToken,
      query: { fields: TIKTOK_CAMPOS_VIDEO },
      body: { max_count: Math.min(TIKTOK_VIDEOS_POR_PAGINA, max - videos.length), ...(cursor ? { cursor } : {}) },
    })
    videos.push(...(datos.videos || []))
    if (!datos.has_more || !datos.cursor || !(datos.videos || []).length) break
    cursor = datos.cursor
  }
  return videos.map(v => ({
    id: String(v.id),
    fecha: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    texto: (v.title || v.video_description || '').slice(0, 160),
    enlace: v.share_url || null,
    // La URL de la portada caduca a las pocas horas: vale para la caché de 1 h.
    miniatura: v.cover_image_url || null,
    duracionSeg: v.duration ?? null,
    visualizaciones: v.view_count ?? null,
    meGusta: v.like_count ?? null,
    comentarios: v.comment_count ?? null,
    compartidos: v.share_count ?? null,
  }))
}

async function perfilTikTok(accessToken, permisos) {
  const campos = ['open_id', 'avatar_url', 'display_name', ...(permisos.includes('user.info.profile') ? ['username'] : []),
    'follower_count', 'following_count', 'likes_count', 'video_count']
  const { user = {} } = await tiktokApi('user/info/', { accessToken, metodo: 'GET', query: { fields: campos.join(',') } })
  return {
    usuario: user.username || null,
    nombre: user.display_name || null,
    foto: user.avatar_url || null,
    seguidores: user.follower_count ?? null,
    siguiendo: user.following_count ?? null,
    meGusta: user.likes_count ?? null,
    videos: user.video_count ?? null,
  }
}

async function obtenerMetricasTikTok(accessToken, permisos, maxVideos = TIKTOK_MAX_VIDEOS_METRICAS) {
  const [perfil, videos] = await Promise.all([perfilTikTok(accessToken, permisos), listarVideosTikTok(accessToken, maxVideos)])
  return {
    perfil,
    cuenta: {
      // Suma de los vídeos listados (TikTok no da un total de la cuenta).
      visualizaciones: sumaVisualizaciones(videos),
      meGusta: videos.reduce((t, v) => t + (Number(v.meGusta) || 0), 0),
      comentarios: videos.reduce((t, v) => t + (Number(v.comentarios) || 0), 0),
      compartidos: videos.reduce((t, v) => t + (Number(v.compartidos) || 0), 0),
      videosListados: videos.length,
    },
    videos,
  }
}

// Una fila por cliente y día: si se toma dos veces el mismo día, vale la última.
async function guardarFotoDiaTikTok(clienteId, perfil, videos) {
  const { error } = await supabaseAdmin.from('tiktok_metricas_dia').upsert({
    cliente_id: clienteId,
    dia: diaUtc(),
    seguidores: perfil.seguidores,
    me_gustas: perfil.meGusta,
    videos: perfil.videos,
    visualizaciones_totales: sumaVisualizaciones(videos),
    videos_listados: videos.length,
    tomado_en: new Date().toISOString(),
  }, { onConflict: 'cliente_id,dia' })
  if (error && !esTablaTikTokInexistente(error)) console.error('[tiktok] error guardando la foto del día:', error.message)
  return !error
}

// Métricas con caché de 1 h en tiktok_metricas_cache (?refrescar=1 la salta,
// como mucho cada 5 min), igual que Instagram. Sin la migración 0050 funciona
// sin caché.
app.get('/api/tiktok/metricas/:clienteId', requireAuth, requireClienteTikTok(), async (req, res) => {
  if (!tiktokConfigurado()) {
    return res.status(503).json({ error: 'La conexión con TikTok todavía no está configurada', codigo: 'no_configurado' })
  }
  const clienteId = req.clienteTikTok.id
  const refrescar = req.query.refrescar === '1'

  const conexion = await conexionTikTok(clienteId)
  if (!conexion || conexion.estado !== 'activa') {
    return res.status(409).json({ error: 'Este cliente no tiene TikTok conectado', codigo: 'no_conectado' })
  }
  if (!tienePermisosMetricasTikTok(conexion)) return res.status(409).json({ error: MENSAJE_PERMISOS_METRICAS_TIKTOK, codigo: 'reconectar' })

  const { data: cache } = await supabaseAdmin.from('tiktok_metricas_cache')
    .select('datos, actualizado_en').eq('cliente_id', clienteId).maybeSingle()
  const edadMs = cache ? Date.now() - new Date(cache.actualizado_en).getTime() : Infinity
  if (cache && (edadMs < TIKTOK_REFRESCO_MIN_MS || (!refrescar && edadMs < TIKTOK_CACHE_TTL_MS))) {
    return res.json({ ...cache.datos, actualizadoEn: cache.actualizado_en, desdeCache: true })
  }

  const accessToken = await tokenTikTokVigente(clienteId).catch(() => null)
  if (!accessToken) return res.status(409).json({ error: ERRORES_TIKTOK.access_token_invalid, codigo: 'reconectar' })

  try {
    const datos = await obtenerMetricasTikTok(accessToken, conexion.permisos || [])
    const actualizadoEn = new Date().toISOString()
    const { error } = await supabaseAdmin.from('tiktok_metricas_cache')
      .upsert({ cliente_id: clienteId, datos, actualizado_en: actualizadoEn }, { onConflict: 'cliente_id' })
    if (error && !esTablaTikTokInexistente(error)) console.error('[tiktok] error guardando la caché de métricas:', error.message)
    await marcarConexionTikTok(clienteId, {
      ultimo_error: null,
      ...(datos.perfil.usuario ? { username: datos.perfil.usuario } : {}),
      ...(datos.perfil.nombre ? { nombre: datos.perfil.nombre } : {}),
      ...(datos.perfil.foto ? { avatar_url: datos.perfil.foto } : {}),
    })
    res.json({ ...datos, actualizadoEn, desdeCache: false })
  } catch (err) {
    console.error('[tiktok] error pidiendo métricas:', err.code, err.message, err.logId || '')
    if (tokenTikTokInvalido(err)) {
      await marcarConexionTikTok(clienteId, { estado: 'caducada', ultimo_error: 'El permiso de TikTok caducó o se revocó' })
      return res.status(409).json({ error: ERRORES_TIKTOK.access_token_invalid, codigo: 'reconectar' })
    }
    if (err.code === 'scope_not_authorized') return res.status(409).json({ error: MENSAJE_PERMISOS_METRICAS_TIKTOK, codigo: 'reconectar' })
    await marcarConexionTikTok(clienteId, { ultimo_error: 'TikTok no respondió al pedir las métricas' })
    if (cache) return res.json({ ...cache.datos, actualizadoEn: cache.actualizado_en, desdeCache: true, aviso: 'TikTok no respondió; se muestran los últimos datos guardados.' })
    res.status(502).json({ error: 'TikTok no respondió al pedir las métricas. Inténtalo de nuevo en unos minutos.' })
  }
})

// Visualizaciones de TikTok por mes para la tarjeta del Inicio (ver
// /api/instagram/visitas-mensuales). Las de un mes = visualizaciones_totales de
// la última foto del mes menos la última del mes anterior. El primer mes con
// fotos se cuenta desde la primera foto (no hay histórico anterior); un mes sin
// fotos queda en null. Si sale negativo (vídeos borrados o que salieron de la
// lista), se cuenta 0.
async function visitasMensualesTikTok(clienteIds, meses) {
  if (!clienteIds.length) return { cuentas: 0, valores: {} }
  const { data: conexiones, error: errorConexiones } = await supabaseAdmin.from('tiktok_conexiones')
    .select('cliente_id').in('cliente_id', clienteIds).eq('estado', 'activa')
  if (errorConexiones) return { cuentas: 0, valores: {} }
  const conectados = (conexiones || []).map(c => c.cliente_id)
  if (!conectados.length) return { cuentas: 0, valores: {} }

  const desde = new Date(meses[0].inicio)
  desde.setUTCMonth(desde.getUTCMonth() - 1)
  const { data: fotos, error } = await supabaseAdmin.from('tiktok_metricas_dia')
    .select('cliente_id, dia, visualizaciones_totales')
    .in('cliente_id', conectados).gte('dia', diaUtc(desde)).order('dia', { ascending: true })
  if (error) {
    if (!esTablaTikTokInexistente(error)) console.error('[tiktok] visitas por mes:', error.message)
    return { cuentas: conectados.length, valores: {} }
  }

  const valores = {}
  for (const mes of meses) {
    const inicio = diaUtc(mes.inicio)
    const fin = diaUtc(mes.fin)
    let total = null
    for (const clienteId of conectados) {
      const suyas = (fotos || []).filter(f => f.cliente_id === clienteId && f.visualizaciones_totales != null)
      const delMes = suyas.filter(f => f.dia >= inicio && f.dia < fin)
      if (!delMes.length) continue
      const antes = suyas.filter(f => f.dia < inicio)
      const base = antes.length ? antes[antes.length - 1] : delMes[0]
      const diferencia = Number(delMes[delMes.length - 1].visualizaciones_totales) - Number(base.visualizaciones_totales)
      total = (total || 0) + Math.max(0, diferencia)
    }
    valores[mes.mes] = total
  }
  return { cuentas: conectados.length, valores }
}

// ── Vídeos a las 24 h y foto diaria ──
// Como cicloReels24h: como mucho cada 15 min, colgado del tick. Por cuenta:
// - una vez al día, la foto de los contadores (tiktok_metricas_dia), con hasta
//   200 vídeos;
// - una vez por vídeo, entre las 24 y las 48 h de publicarse, sus números
//   (tiktok_videos_24h). TikTok no da alcance ni retención.
let cicloMetricasTikTokEnCurso = false
let ultimoCicloMetricasTikTok = 0

async function fotoVideos24hTikTok(clienteId, videos) {
  const ahora = Date.now()
  const candidatos = videos.filter(v => {
    const edad = v.fecha ? ahora - new Date(v.fecha).getTime() : -1
    return edad >= 24 * HORA_MS && edad < 48 * HORA_MS
  })
  if (!candidatos.length) return 0
  const { data: yaTomados, error: errorTomados } = await supabaseAdmin.from('tiktok_videos_24h')
    .select('video_id').eq('cliente_id', clienteId).in('video_id', candidatos.map(v => v.id))
  if (errorTomados) throw new Error(errorTomados.message)
  const tomados = new Set((yaTomados || []).map(f => f.video_id))
  const nuevos = candidatos.filter(v => !tomados.has(v.id))
  if (!nuevos.length) return 0
  const { error } = await supabaseAdmin.from('tiktok_videos_24h').upsert(nuevos.map(v => ({
    cliente_id: clienteId,
    video_id: v.id,
    publicado_en: v.fecha,
    tomado_en: new Date().toISOString(),
    horas: Math.round((ahora - new Date(v.fecha).getTime()) / HORA_MS * 10) / 10,
    enlace: v.enlace,
    texto: v.texto,
    visualizaciones: v.visualizaciones,
    me_gusta: v.meGusta,
    comentarios: v.comentarios,
    compartidos: v.compartidos,
  })), { onConflict: 'cliente_id,video_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
  return nuevos.length
}

async function metricasTikTokCliente(conexion, hoyTomada) {
  const accessToken = await tokenTikTokVigente(conexion.cliente_id)
  if (!accessToken) return 0
  if (hoyTomada) {
    // Solo hace falta la primera página para ver los vídeos de hace 24-48 h.
    const videos = await listarVideosTikTok(accessToken, TIKTOK_VIDEOS_POR_PAGINA)
    return fotoVideos24hTikTok(conexion.cliente_id, videos)
  }
  const { perfil, videos } = await obtenerMetricasTikTok(accessToken, conexion.permisos || [], TIKTOK_MAX_VIDEOS_FOTO)
  await guardarFotoDiaTikTok(conexion.cliente_id, perfil, videos)
  return fotoVideos24hTikTok(conexion.cliente_id, videos)
}

async function cicloMetricasTikTok() {
  if (cicloMetricasTikTokEnCurso || !tiktokConfigurado()) return
  if (Date.now() - ultimoCicloMetricasTikTok < REELS_24H_INTERVALO_MS) return
  cicloMetricasTikTokEnCurso = true
  ultimoCicloMetricasTikTok = Date.now()
  try {
    const { data: conexiones, error } = await supabaseAdmin.from('tiktok_conexiones')
      .select('cliente_id, username, permisos').eq('estado', 'activa')
    if (error) return
    const conMetricas = (conexiones || []).filter(tienePermisosMetricasTikTok)
    if (!conMetricas.length) return
    // Sin la migración 0050 no hay dónde guardar: se para aquí.
    const { data: deHoy, error: errorHoy } = await supabaseAdmin.from('tiktok_metricas_dia')
      .select('cliente_id').eq('dia', diaUtc()).in('cliente_id', conMetricas.map(c => c.cliente_id))
    if (errorHoy) {
      if (!esTablaTikTokInexistente(errorHoy)) console.error('[tiktok] error leyendo las fotos del día:', errorHoy.message)
      return
    }
    const tomadas = new Set((deHoy || []).map(f => f.cliente_id))
    for (const conexion of conMetricas) {
      try {
        const nuevos = await metricasTikTokCliente(conexion, tomadas.has(conexion.cliente_id))
        if (nuevos) console.log(`[tiktok] vídeos 24 h de @${conexion.username || conexion.cliente_id}: ${nuevos} nuevos`)
      } catch (err) {
        // Una cuenta caída (token caducado, permisos) no frena a las demás.
        console.error(`[tiktok] métricas de ${conexion.cliente_id}:`, err.code || '', err.message)
      }
    }
  } catch (err) {
    console.error('[tiktok] error en el ciclo de métricas:', err.message)
  } finally {
    cicloMetricasTikTokEnCurso = false
  }
}

if (supabaseAdmin) setInterval(cicloMetricasTikTok, PUBLICAR_INTERVALO_MS)

// ─── Google Business OAuth ────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3011/api/google/callback'
const GOOGLE_FRONTEND_URL  = process.env.GOOGLE_FRONTEND_URL || 'http://localhost:5174'
const GOOGLE_SCOPES        = 'https://www.googleapis.com/auth/business.manage'

app.get('/api/google/auth', (req, res) => {
  const { clienteId } = req.query

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'Google OAuth no configurado',
      mensaje: 'Añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET al .env',
      configurado: false,
    })
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('state', clienteId || '')
  url.searchParams.set('prompt', 'consent')
  res.json({ url: url.toString(), configurado: true })
})

app.get('/api/google/callback', async (req, res) => {
  try {
    const { code, state: clienteId, error } = req.query
    if (error) return res.redirect(`${GOOGLE_FRONTEND_URL}/googlemaps?error=${error}`)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    })
    const tokens = await tokenRes.json()
    console.log('[Google OAuth] Tokens para cliente:', clienteId)

    const params = new URLSearchParams({
      clienteId:    clienteId || '',
      accessToken:  tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      expiryDate:   tokens.expiry_date || String(Date.now() + (tokens.expires_in || 3600) * 1000),
    })
    res.redirect(`${GOOGLE_FRONTEND_URL}/googlemaps?${params}`)
  } catch (err) {
    console.error('[Google OAuth] Error:', err.message)
    res.redirect(`${GOOGLE_FRONTEND_URL}/googlemaps?error=auth_failed`)
  }
})

app.get('/api/google/accounts', async (req, res) => {
  try {
    const { accessToken } = req.query
    const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/google/locations', async (req, res) => {
  try {
    const { accessToken, accountName } = req.query
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/google/reviews', async (req, res) => {
  try {
    const { accessToken, accountId, locationId } = req.query
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    )
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/google/reviews/reply', async (req, res) => {
  try {
    const { accessToken, accountId, locationId, reviewId, comment } = req.body
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      }
    )
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/google/posts', async (req, res) => {
  try {
    const { accessToken, accountId, locationId, post } = req.body
    const body = {
      languageCode: 'es',
      summary: post.descripcion,
      topicType: post.tipo || 'STANDARD',
    }
    if (post.cta && post.url) body.callToAction = { actionType: post.cta, url: post.url }
    if (post.tipo === 'OFFER') {
      body.offer = { couponCode: post.codigoDescuento || '', termsConditions: '' }
      if (post.tituloOferta) body.event = { title: post.tituloOferta }
    }
    if (post.tipo === 'EVENT' && post.nombreEvento) {
      body.event = { title: post.nombreEvento }
    }
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// MCP de Aify: POST /mcp con clave de API (mcp/servidor.js, docs/mcp.md). Va
// aquí, al final, porque le pasa funciones y constantes de todo el archivo.
montarMcp(app, {
  supabaseAdmin,
  requireClaveApi,
  programarPublicacion,
  bucketPublicaciones: BUCKET_PUBLICACIONES,
  // TikTok: las mismas funciones que los endpoints de la web
  programarPublicacionTikTok,
  moverPublicacionTikTok,
  creadorTikTok,
  conexionTikTok,
  tiktokConfigurado,
  tiktokAuditada: TIKTOK_AUDITADA,
  permisoPublicarTikTok: PERMISO_PUBLICAR_TIKTOK,
})

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3011

console.log('[Server] Endpoints registrados:')
console.log('  POST /api/gemini')
console.log('  POST /api/claude-vision')
console.log('  POST /api/gemini-analyze')
console.log('  POST /api/analizar-web')
console.log('  GET  /api/trends')
console.log('  POST /api/palabras-clave')
console.log('  POST /api/palabras-clave/contenido')
console.log('  GET  /api/instagram/conectar')
console.log('  GET  /api/instagram/callback')
console.log('  GET  /api/instagram/estado/:clienteId')
console.log('  GET  /api/instagram/metricas/:clienteId')
console.log('  GET  /api/instagram/visitas-mensuales')
console.log('  GET  /api/instagram/video/:clienteId/:mediaId')
console.log('  DEL  /api/instagram/conexion/:clienteId')
console.log('  GET  /api/instagram/webhook (verificación) · POST /api/instagram/webhook')
console.log('  GET  /api/instagram/dm/:clienteId · POST/PATCH/DEL /api/instagram/dm/:clienteId/reglas')
console.log('  GET  /api/instagram/media/:clienteId')
console.log('  GET  /api/instagram/publicar/:clienteId · PUT/DEL /api/instagram/publicar/:clienteId/:postId')
console.log('  POST /api/instagram/publicar/tick')
console.log('  GET  /api/tiktok/conectar · GET /api/tiktok/callback · GET /api/tiktok/estado/:clienteId · DEL /api/tiktok/conexion/:clienteId')
console.log('  GET  /api/tiktok/creador/:clienteId · GET /api/tiktok/medios/:archivo')
console.log('  GET  /api/tiktok/publicar/:clienteId · PUT/PATCH/DEL /api/tiktok/publicar/:clienteId/:postId')
console.log('  POST /api/tiktok/webhook')
console.log('  GET  /api/google/auth')
console.log('  GET  /api/google/callback')
console.log('  GET  /api/google/accounts')
console.log('  GET  /api/google/locations')
console.log('  GET  /api/google/reviews')
console.log('  POST /api/google/reviews/reply')
console.log('  POST /api/google/posts')
console.log('  GET  /api/test')
console.log('  GET  /api/ping')
console.log('  POST /api/pictures/lista-espera')
console.log('  GET  /api/calendar-feed/:token.ics')
console.log('  GET/POST /api/claves-api · DEL /api/claves-api/:id')
console.log('  POST /mcp (MCP de Aify, clave de API)')

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nAify proxy corriendo en http://localhost:${PORT}`)
  console.log(`  Modelos: ${MODELOS.join(' → ')}`)
  console.log(`  Test:    http://localhost:${PORT}/api/test\n`)
})

// Para el MCP de Aify (parte 2/3)
export { requireClaveApi }
