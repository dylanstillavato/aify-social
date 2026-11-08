// node --test mcp/trial.test.js
// Herramientas reales, por MCP de verdad (cliente + HTTP), con Supabase en memoria.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { montarMcp } from './servidor.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const CLIENTE = '22222222-2222-4222-8222-222222222222'
const POST = '33333333-3333-4333-8333-333333333333'
const PUBLICADO = '44444444-4444-4444-8444-444444444444'
const TRIAL = '66666666-6666-4666-8666-666666666666'
const NORMAL = '77777777-7777-4777-8777-777777777777'
const VIDEO = `${ORG}/${CLIENTE}/a.mp4`
const JPG = `${ORG}/${CLIENTE}/p.jpg`

const filas = {
  clientes: [{ id: CLIENTE, nombre: 'Prueba', organizacion_id: ORG, user_id: 'u' }],
  calendario_posts: [
    { id: POST, cliente_id: CLIENTE, fecha: '2099-01-02', hora: '10:00:00', titulo: 'x' }, { id: PUBLICADO, cliente_id: CLIENTE },
    { id: TRIAL, cliente_id: CLIENTE, fecha: '2099-03-05', hora: '12:00:00', titulo: 'trial', formato: 'reel' },
    { id: NORMAL, cliente_id: CLIENTE, fecha: '2099-03-06', hora: '12:00:00', titulo: 'normal', formato: 'reel' },
  ],
  instagram_publicaciones: [
    { post_id: PUBLICADO, estado: 'publicado', ig_media_id: 'm1', es_trial: true, publicado_en: new Date(Date.now() - 72 * 3600e3).toISOString(), permalink: 'https://www.instagram.com/reel/z/' },
    { post_id: TRIAL, tipo: 'reel', estado: 'programado', publicar_en: '2099-03-05T12:00:00+01:00', es_trial: true, trial_graduacion: 'SS_PERFORMANCE' },
    { post_id: NORMAL, tipo: 'reel', estado: 'programado', publicar_en: '2099-03-06T12:00:00+01:00', es_trial: false, trial_graduacion: null },
  ],
}

// Respeta las columnas del select: si la herramienta no pide un campo, no le llega
function soloColumnas(fila, columnas) {
  if (!columnas || columnas.trim() === '*') return fila
  return Object.fromEntries(columnas.split(',').map(c => c.trim()).filter(c => c in fila).map(c => [c, fila[c]]))
}

function consulta(nombre) {
  const fs = []
  let columnas = '*'
  let lista = () => (filas[nombre] || []).filter(f => fs.every(cumple => cumple(f))).map(f => soloColumnas(f, columnas))
  const q = {
    select: (c) => { columnas = c; return q },
    eq: (c, v) => { fs.push(f => f[c] === v); return q },
    in: (c, vs) => { fs.push(f => vs.includes(f[c])); return q },
    gte: (c, v) => { fs.push(f => f[c] >= v); return q },
    lt: (c, v) => { fs.push(f => f[c] < v); return q },
    order: () => q, limit: () => q, lte: () => q, is: () => q, neq: () => q, not: () => q,
    maybeSingle: async () => ({ data: lista()[0] || null, error: null }),
    single: async () => ({ data: lista()[0] || null, error: lista()[0] ? null : { message: 'sin fila' } }),
    then: (ok) => ok({ data: lista(), error: null }),
  }
  return q
}
const supabaseAdmin = {
  from: consulta,
  storage: { from: () => ({ list: async (_p, { search }) => ({ data: [{ name: search, metadata: { size: 10 } }], error: null }) }) },
}

let servidor, cliente
const recibidos = []
let metricasFallan = false

before(async () => {
  const app = express()
  app.use(express.json())
  const programarPublicacion = async ({ body, postId }) => {
    recibidos.push(body)
    return { publicacion: { post_id: postId, tipo: body.tipo, estado: 'programado', publicar_en: body.publicarEn, archivos: body.archivos, es_trial: Boolean(body.esTrial), trial_graduacion: body.trialGraduacion || 'MANUAL', portada_ruta: body.portadaRuta || null } }
  }
  montarMcp(app, {
    supabaseAdmin,
    requireClaveApi: (req, _res, next) => { req.organizacionId = ORG; req.userId = 'u'; next() },
    programarPublicacion,
    metricasDirectasReel: async ({ mediaId }) => {
      if (metricasFallan) throw new Error('meta caída')
      return { visualizaciones: 1000, alcance: 800, compartidos: 40, mediaId }
    },
    bucketPublicaciones: 'publicaciones',
    programarPublicacionTikTok: async () => ({}), moverPublicacionTikTok: async () => ({}), creadorTikTok: async () => ({}), conexionTikTok: async () => null,
    tiktokConfigurado: () => false, tiktokAuditada: false, permisoPublicarTikTok: 'video.publish',
  })
  await new Promise(ok => { servidor = app.listen(0, '127.0.0.1', ok) })
  cliente = new Client({ name: 'prueba', version: '1' })
  await cliente.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${servidor.address().port}/mcp`)))
})
after(async () => { await cliente.close(); servidor.close() })

async function llamar(name, args) {
  const r = await cliente.callTool({ name, arguments: args })
  const texto = r.content.map(b => b.text).join('')
  if (r.isError) return { error: texto }
  return JSON.parse(texto)
}
const base = { cliente_id: CLIENTE, post_id: POST, tipo: 'reel', rutas: [VIDEO], caption: 'c', publicar_en: '2099-01-02T10:00:00+01:00' }

test('tools/list expone Trial y portada: AifyOS lo comprueba antes de programar', async () => {
  const { tools } = await cliente.listTools()
  const p = tools.find(t => t.name === 'programar_publicacion').inputSchema.properties
  assert.ok(p.es_trial)
  assert.deepEqual(p.trial_graduacion.enum, ['MANUAL', 'SS_PERFORMANCE'])
  assert.ok(p.portada_ruta)
  assert.ok(tools.find(t => t.name === 'ver_metricas').inputSchema.properties.post_id)
})

test('programa un Trial Reel con graduación y portada, y lo devuelve en la respuesta', async () => {
  recibidos.length = 0
  const r = await llamar('programar_publicacion', { ...base, es_trial: true, trial_graduacion: 'SS_PERFORMANCE', portada_ruta: JPG, portada_nombre: 'p.jpg' })
  assert.equal(r.publicacion.es_trial, true)
  assert.equal(r.publicacion.trial_graduacion, 'SS_PERFORMANCE')
  assert.equal(r.publicacion.portada, true)
  assert.equal(recibidos[0].esTrial, true)
  assert.equal(recibidos[0].trialGraduacion, 'SS_PERFORMANCE')
  assert.equal(recibidos[0].portadaRuta, JPG)
})

test('sin es_trial no se toca: reprogramar conserva lo que tuviera', async () => {
  recibidos.length = 0
  const r = await llamar('programar_publicacion', base)
  assert.equal(r.publicacion.es_trial, false)
  assert.equal('esTrial' in recibidos[0], false)
  assert.equal('trialGraduacion' in recibidos[0], false)
})

test('es_trial false se manda: deja de ser Trial', async () => {
  recibidos.length = 0
  await llamar('programar_publicacion', { ...base, es_trial: false })
  assert.equal(recibidos[0].esTrial, false)
})

test('rechaza lo que no tiene sentido', async () => {
  recibidos.length = 0
  assert.match((await llamar('programar_publicacion', { ...base, tipo: 'post', rutas: [JPG], es_trial: true })).error, /solo para reels/)
  assert.match((await llamar('programar_publicacion', { ...base, trial_graduacion: 'MANUAL' })).error, /es_trial: true/)
  assert.match((await llamar('programar_publicacion', { ...base, portada_ruta: VIDEO })).error, /JPEG/)
  assert.match((await llamar('programar_publicacion', { ...base, es_trial: true, trial_graduacion: 'OTRA' })).error, /trial_graduacion|Invalid/i)
  assert.match((await llamar('programar_publicacion', { ...base, portada_ruta: `otra/${CLIENTE}/p.jpg` })).error, /no es de este cliente/)
  assert.equal(recibidos.length, 0)
})

test('ver_metricas con post_id trae la lectura directa; sin él, nada', async () => {
  const con = await llamar('ver_metricas', { cliente_id: CLIENTE, post_id: PUBLICADO })
  assert.equal(con.reel_directo.disponible, true)
  assert.equal(con.reel_directo.es_trial, true)
  assert.equal(con.reel_directo.compartidos, 40)
  assert.ok(Math.abs(con.reel_directo.horas - 72) < 0.2)
  const sin = await llamar('ver_metricas', { cliente_id: CLIENTE })
  assert.equal('reel_directo' in sin, false)
})

test('ver_metricas: sin publicar o con Meta caída lo dice, no inventa', async () => {
  const noPublicado = await llamar('ver_metricas', { cliente_id: CLIENTE, post_id: POST })
  assert.equal(noPublicado.reel_directo.disponible, false)
  metricasFallan = true
  const caido = await llamar('ver_metricas', { cliente_id: CLIENTE, post_id: PUBLICADO })
  metricasFallan = false
  assert.equal(caido.reel_directo.disponible, false)
  const ajeno = await llamar('ver_metricas', { cliente_id: CLIENTE, post_id: '55555555-5555-4555-8555-555555555555' })
  assert.match(ajeno.error, /Ningún|ningún/)
})

test('ver_calendario dice si un reel programado es Trial y con qué graduación', async () => {
  const r = await llamar('ver_calendario', { cliente_id: CLIENTE, mes: '2099-03' })
  const trial = r.posts.find(p => p.id === TRIAL)
  assert.equal(trial.instagram.es_trial, true)
  assert.equal(trial.instagram.trial_graduacion, 'SS_PERFORMANCE')
  const normal = r.posts.find(p => p.id === NORMAL)
  assert.equal(normal.instagram.es_trial, false)
  assert.equal(normal.instagram.trial_graduacion, null)
})
