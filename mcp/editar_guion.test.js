// node --test mcp/editar_guion.test.js
// editar_guion por MCP de verdad (cliente + HTTP), con Supabase en memoria.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { montarMcp } from './servidor.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTRA_ORG = '99999999-9999-4999-8999-999999999999'
const CLIENTE = '22222222-2222-4222-8222-222222222222'
const CLIENTE_AJENO = '88888888-8888-4888-8888-888888888888'
const POST = '33333333-3333-4333-8333-333333333333'
const SIN_GUION = '44444444-4444-4444-8444-444444444444'
const PUBLICADO = '55555555-5555-4555-8555-555555555555'
const EN_TIKTOK = '66666666-6666-4666-8666-666666666666'
const AJENO = '77777777-7777-4777-8777-777777777777'

const GUION = { gancho: 'Gancho', contenido: { frases: ['uno', 'dos'], loopAbierto: 'loop' }, cierre: { cta: 'Sígueme' } }

const filas = {
  clientes: [
    { id: CLIENTE, nombre: 'Prueba', organizacion_id: ORG, user_id: 'u' },
    { id: CLIENTE_AJENO, nombre: 'Ajeno', organizacion_id: OTRA_ORG, user_id: 'v' },
  ],
  calendario_posts: [
    { id: POST, cliente_id: CLIENTE, fecha: '2099-01-02', hora: '10:00:00', titulo: 'Con guion', guion: structuredClone(GUION), copy: 'copy viejo', hashtags: '#viejo', notas: 'notas viejas' },
    { id: SIN_GUION, cliente_id: CLIENTE, fecha: '2099-01-03', titulo: 'Sin guion', guion: null },
    { id: PUBLICADO, cliente_id: CLIENTE, fecha: '2099-01-04', titulo: 'Publicado', guion: structuredClone(GUION) },
    { id: EN_TIKTOK, cliente_id: CLIENTE, fecha: '2099-01-05', titulo: 'Publicándose', guion: structuredClone(GUION) },
    { id: AJENO, cliente_id: CLIENTE_AJENO, fecha: '2099-01-06', titulo: 'De otra organización', guion: structuredClone(GUION) },
  ],
  instagram_publicaciones: [{ post_id: PUBLICADO, estado: 'publicado' }],
  tiktok_publicaciones: [{ post_id: EN_TIKTOK, estado: 'procesando' }],
}
const actualizaciones = []

function consulta(nombre) {
  const fs = []
  let cambios = null
  const lista = () => (filas[nombre] || []).filter(f => fs.every(([c, v]) => f[c] === v))
  const q = {
    select: () => q, eq: (c, v) => { fs.push([c, v]); return q }, in: () => q, order: () => q, limit: () => q,
    update: (c) => { cambios = c; return q },
    maybeSingle: async () => ({ data: lista()[0] || null, error: null }),
    single: async () => ({ data: lista()[0] || null, error: lista()[0] ? null : { message: 'sin fila' } }),
    then: (ok) => {
      if (cambios) {
        for (const f of lista()) { Object.assign(f, cambios); actualizaciones.push({ tabla: nombre, id: f.id, cambios }) }
      }
      return ok({ data: lista(), error: null })
    },
  }
  return q
}

let servidor, cliente

before(async () => {
  const app = express()
  app.use(express.json())
  montarMcp(app, {
    supabaseAdmin: { from: consulta, storage: { from: () => ({}) } },
    requireClaveApi: (req, _res, next) => { req.organizacionId = ORG; req.userId = 'u'; next() },
    programarPublicacion: async () => ({}),
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
const fila = (id) => filas.calendario_posts.find(p => p.id === id)

test('editar_guion sale en la lista de herramientas', async () => {
  const { tools } = await cliente.listTools()
  const t = tools.find(x => x.name === 'editar_guion')
  assert.ok(t)
  assert.deepEqual(t.inputSchema.required, ['post_id'])
  for (const campo of ['frases', 'copy', 'hashtags', 'notas']) assert.ok(t.inputSchema.properties[campo])
})

test('cambia solo los campos enviados y devuelve lo mismo que ver_guion', async () => {
  const r = await llamar('editar_guion', { post_id: POST, frases: ['tres', ' ', 'cuatro '], hashtags: '#nuevo' })
  assert.deepEqual(r.guion.contenido.frases, ['tres', 'cuatro'])
  assert.equal(r.guion.contenido.loopAbierto, 'loop')
  assert.equal(r.guion.gancho, 'Gancho')
  assert.equal(r.hashtags, '#nuevo')
  assert.equal(r.copy, 'copy viejo')
  assert.equal(r.notas, 'notas viejas')
  assert.equal(fila(POST).copy, 'copy viejo')
  assert.deepEqual(r, await llamar('ver_guion', { post_id: POST }))
  const { cambios } = actualizaciones.at(-1)
  assert.deepEqual(Object.keys(cambios).sort(), ['guion', 'hashtags'])
})

test('solo el copy no toca el guion', async () => {
  const antes = structuredClone(fila(POST).guion)
  const r = await llamar('editar_guion', { post_id: POST, copy: 'copy nuevo', notas: '' })
  assert.equal(r.copy, 'copy nuevo')
  assert.equal(r.notas, '')
  assert.deepEqual(fila(POST).guion, antes)
  assert.deepEqual(Object.keys(actualizaciones.at(-1).cambios).sort(), ['copy', 'notas'])
})

test('sin guion y con frases, lo crea como crear_post', async () => {
  const r = await llamar('editar_guion', { post_id: SIN_GUION, frases: ['hola', 'adiós'] })
  assert.deepEqual(r.guion, { contenido: { frases: ['hola', 'adiós'] } })
  assert.deepEqual(fila(SIN_GUION).guion, { contenido: { frases: ['hola', 'adiós'] } })
})

test('sin ningún campo editable, error claro', async () => {
  const n = actualizaciones.length
  assert.match((await llamar('editar_guion', { post_id: POST })).error, /nada que cambiar/)
  assert.equal(actualizaciones.length, n)
})

test('un post de otra organización no se puede editar', async () => {
  const n = actualizaciones.length
  assert.match((await llamar('editar_guion', { post_id: AJENO, copy: 'x' })).error, /ningún post con ese id en tu organización/)
  assert.equal(actualizaciones.length, n)
  assert.equal(fila(AJENO).copy, undefined)
})

test('un post ya publicado o publicándose no se puede editar', async () => {
  const n = actualizaciones.length
  assert.match((await llamar('editar_guion', { post_id: PUBLICADO, frases: ['x'] })).error, /ya está publicado en Instagram/)
  assert.match((await llamar('editar_guion', { post_id: EN_TIKTOK, copy: 'x' })).error, /publicando en TikTok/)
  assert.equal(actualizaciones.length, n)
  assert.deepEqual(fila(PUBLICADO).guion, GUION)
})
