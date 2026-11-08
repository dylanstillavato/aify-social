// node --test mcp/operar_aifyos.test.js
// Lo que necesita AifyOS para operar por MCP, de verdad (cliente + HTTP), con
// Supabase en memoria: la tabla de posts imita los triggers de la migración 0019.
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { montarMcp } from './servidor.js'
import { crearCancelarPublicacion } from './publicaciones.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTRA_ORG = '99999999-9999-4999-8999-999999999999'
const CLIENTE = '22222222-2222-4222-8222-222222222222'
const AJENO = '88888888-8888-4888-8888-888888888888'
const COL1 = 'c0000000-0000-4000-8000-000000000001'
const COL2 = 'c0000000-0000-4000-8000-000000000002'
const id = (n) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`
const IDEA = id(100)
const IDEA_SIN_GUION = id(101)
const IDEA_DE_POST = id(102)
const IDEA_AJENA = id(103)
const POST_AJENO = id(50)

const GUION = () => ({
  gancho: 'Gancho', problema: { texto: 'P', segundos: '4-10' }, promesa: { texto: 'Q', segundos: '10-20' },
  contenido: { frases: ['uno'], loopAbierto: 'loop' }, cierre: { remate: 'R', cta: 'C', segundos: '20-25' }, planos: [{ segundos: '0-3', plano: 'Primer', visual: 'V', dice: 'D' }],
})

let filas, escrituras, enlaces
const reiniciar = () => {
  escrituras = []
  enlaces = 0
  filas = {
    clientes: [
      { id: CLIENTE, nombre: 'Prueba', organizacion_id: ORG, user_id: 'u' },
      { id: AJENO, nombre: 'Ajeno', organizacion_id: OTRA_ORG, user_id: 'v' },
    ],
    calendario_posts: [
      { id: id(1), cliente_id: CLIENTE, fecha: '2099-01-02', hora: '10:00:00', titulo: 'Con guion', red: 'instagram', comparte_en: [], formato: 'video', estado: 'borrador', guion: GUION(), aprobacion_estado: null, aprobacion_comentario: null, aprobacion_en: null, grabado_en: null, origen_idea_id: IDEA },
      { id: id(2), cliente_id: CLIENTE, fecha: '2099-01-03', titulo: 'Sin guion', red: 'instagram', comparte_en: [], formato: 'video', estado: 'borrador', guion: null },
      { id: id(3), cliente_id: CLIENTE, fecha: '2099-01-04', titulo: 'Aprobado', red: 'instagram', comparte_en: [], formato: 'video', estado: 'borrador', guion: GUION(), aprobacion_estado: 'aprobado', aprobacion_comentario: 'Genial', aprobacion_en: '2098-12-30T10:00:00.000Z' },
      { id: id(4), cliente_id: CLIENTE, fecha: '2099-01-05', titulo: 'Con cambios', red: 'instagram', comparte_en: [], formato: 'video', estado: 'borrador', guion: GUION(), aprobacion_estado: 'cambios', aprobacion_comentario: 'Cambia el gancho', aprobacion_en: '2098-12-30T10:00:00.000Z' },
      { id: id(5), cliente_id: CLIENTE, fecha: '2099-01-06', titulo: 'Programado IG', red: 'instagram', comparte_en: ['tiktok'], formato: 'video', estado: 'borrador', guion: null },
      { id: id(6), cliente_id: CLIENTE, fecha: '2099-01-07', titulo: 'Publicándose', red: 'tiktok', comparte_en: [], formato: 'video', estado: 'borrador', guion: GUION() },
      { id: id(7), cliente_id: CLIENTE, fecha: '2099-01-08', titulo: 'Publicado a mano', red: 'instagram', comparte_en: [], formato: 'video', estado: 'publicado', guion: null },
      { id: id(8), cliente_id: CLIENTE, fecha: '2099-01-09', titulo: 'Publicado en IG', red: 'instagram', comparte_en: [], formato: 'video', estado: 'borrador', guion: null },
      { id: id(9), cliente_id: CLIENTE, fecha: '2099-02-01', en_calendario: false, titulo: 'De idea con post', red: 'instagram', formato: 'video', guion: { gancho: 'Del post' }, origen_idea_id: IDEA_DE_POST, creado_en: '2098-01-01' },
      { id: POST_AJENO, cliente_id: AJENO, fecha: '2099-01-10', titulo: 'Ajeno', red: 'instagram', formato: 'video', guion: GUION(), aprobacion_estado: null },
    ],
    ideas: [
      { id: IDEA, cliente_id: CLIENTE, titulo: 'Idea', guion: { gancho: 'De la idea' }, formato: 'video' },
      { id: IDEA_SIN_GUION, cliente_id: CLIENTE, titulo: 'Idea sin guion', guion: null },
      { id: IDEA_DE_POST, cliente_id: CLIENTE, titulo: 'Idea con post', guion: null },
      { id: IDEA_AJENA, cliente_id: AJENO, titulo: 'Ajena', guion: { gancho: 'secreto' } },
    ],
    instagram_publicaciones: [
      {
        post_id: id(5), cliente_id: CLIENTE, estado: 'programado', tipo: 'reel', publicar_en: '2099-01-06T17:00:00.000Z', caption: 'Hola', compartir_en_feed: true, es_trial: true, trial_graduacion: 'SS_PERFORMANCE',
        archivos: [{ ruta: `${ORG}/${CLIENTE}/a.mp4`, tipo: 'video' }], portada_ruta: `${ORG}/${CLIENTE}/p.jpg`, contenedores: { portada_nombre: 'p.jpg', access: 'NO-SALIR' },
      },
      { post_id: id(8), cliente_id: CLIENTE, estado: 'publicado', tipo: 'reel', publicar_en: '2099-01-09T17:00:00.000Z', archivos: [] },
    ],
    tiktok_publicaciones: [
      { post_id: id(5), cliente_id: CLIENTE, estado: 'error', tipo: 'video', titulo: 'TT', privacidad: 'SELF_ONLY', permitir_comentarios: true, archivos: [{ ruta: `${ORG}/${CLIENTE}/a.mp4`, tipo: 'video' }], archivos_borrados: false },
      { post_id: id(6), cliente_id: CLIENTE, estado: 'procesando', tipo: 'video', archivos: [] },
    ],
    tablero_columnas: [
      { id: COL1, tablero: 'tareas', organizacion_id: ORG, nombre: 'Por grabar', orden: 0 },
      { id: COL2, tablero: 'tareas', organizacion_id: ORG, nombre: 'Por editar', orden: 1 },
    ],
    tareas: [],
    guion_aprobaciones: [],
  }
}

// Trigger de 0019: si cambia el guion y no la aprobación, vuelve a pendiente
function trigger(nombre, fila, cambios) {
  if (nombre === 'calendario_posts' && 'guion' in cambios && JSON.stringify(cambios.guion) !== JSON.stringify(fila.guion) && !('aprobacion_estado' in cambios)) {
    fila.aprobacion_estado = null
    fila.aprobacion_en = null
  }
}

function consulta(nombre) {
  const fs = []
  let cambios = null, borrar = false, nuevas = null
  const lista = () => (filas[nombre] || []).filter(f => fs.every(t => t(f)))
  const aplicar = () => {
    if (cambios) {
      const hechas = lista()
      for (const f of hechas) { trigger(nombre, f, cambios); Object.assign(f, cambios) }
      escrituras.push({ tabla: nombre, cambios })
      cambios = null
      return hechas
    }
    if (borrar) {
      const fuera = new Set(lista())
      filas[nombre] = filas[nombre].filter(f => !fuera.has(f))
      escrituras.push({ tabla: nombre, borrado: fuera.size })
      borrar = false
      return []
    }
    return null
  }
  const insertar = () => {
    if (!nuevas) return
    const copia = [].concat(nuevas).map(f => ({
      ...(nombre === 'guion_aprobaciones' ? { token: `token-${++enlaces}`, estado: 'activo', expira_en: new Date(Date.now() + 30 * 86400e3).toISOString() } : {}),
      id: id(1000 + (filas[nombre]?.length || 0)), ...f,
    }))
    filas[nombre] = [...(filas[nombre] || []), ...copia]
    escrituras.push({ tabla: nombre, insertado: copia })
    nuevas = null
    fs.push(f => copia.includes(f))
  }
  // Como PostgREST: un update devuelve las filas que ha cambiado
  const resultado = () => { insertar(); return aplicar() || lista() }
  const q = {
    select: () => q, order: () => q, limit: () => q,
    eq: (c, v) => { fs.push(f => f[c] === v); return q },
    in: (c, vs) => { if (c === 'estado') fs.push(f => vs.includes(f[c])); return q },
    gte: (c, v) => { fs.push(f => f[c] >= v); return q },
    lt: (c, v) => { fs.push(f => f[c] < v); return q },
    not: (c) => { fs.push(f => f[c] != null); return q },
    update: (c) => { cambios = c; return q },
    delete: () => { borrar = true; return q },
    insert: (f) => { nuevas = f; return q },
    maybeSingle: async () => ({ data: structuredClone(resultado()[0]) || null, error: null }),
    single: async () => {
      const [fila] = resultado()
      return { data: structuredClone(fila) || null, error: fila ? null : { message: 'sin fila' } }
    },
    then: (ok) => ok({ data: structuredClone(resultado()), error: null }),
  }
  return q
}

let servidor, cliente
before(async () => {
  reiniciar()
  const supabaseAdmin = { from: consulta, storage: { from: () => ({}) } }
  const app = express()
  app.use(express.json())
  montarMcp(app, {
    supabaseAdmin,
    requireClaveApi: (req, _res, next) => { req.organizacionId = ORG; req.userId = 'u'; next() },
    programarPublicacion: async () => ({}),
    cancelarPublicacion: crearCancelarPublicacion({ supabaseAdmin, paraCliente: { instagram: (f) => f, tiktok: (f) => f } }),
    bucketPublicaciones: 'publicaciones',
    urlFrontend: 'https://app.ejemplo',
    programarPublicacionTikTok: async () => ({}), moverPublicacionTikTok: async () => ({}), creadorTikTok: async () => ({}), conexionTikTok: async () => null,
    tiktokConfigurado: () => false, tiktokAuditada: false, permisoPublicarTikTok: 'video.publish',
  })
  await new Promise(ok => { servidor = app.listen(0, '127.0.0.1', ok) })
  cliente = new Client({ name: 'prueba', version: '1' })
  await cliente.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${servidor.address().port}/mcp`)))
})
beforeEach(reiniciar)
after(async () => { await cliente.close(); servidor.close() })

async function llamar(name, args) {
  const r = await cliente.callTool({ name, arguments: args })
  const texto = r.content.map(b => b.text).join('')
  if (r.isError) return { error: texto }
  return JSON.parse(texto)
}
const post = (n) => filas.calendario_posts.find(p => p.id === (typeof n === 'number' ? id(n) : n))
const AJENO_ERROR = /ningún post con ese id en tu organización/

test('tools/list: lectura y escritura bien clasificadas, y sin herramientas de borrar', async () => {
  const { tools } = await cliente.listTools()
  const de = (n) => tools.find(t => t.name === n)
  assert.equal(de('ver_publicacion').annotations?.readOnlyHint, true)
  for (const n of ['aprobar_guion', 'crear_enlace_aprobacion', 'cancelar_publicacion', 'marcar_grabado', 'editar_post']) {
    assert.ok(de(n), n)
    assert.notEqual(de(n).annotations?.readOnlyHint, true, n)
  }
  assert.ok(!tools.some(t => /eliminar|borrar/.test(t.name)))
  assert.deepEqual(de('editar_post').inputSchema.required, ['post_id'])
  assert.deepEqual(de('editar_post').inputSchema.properties.formato.enum, ['video', 'carrusel', 'historia', 'reel'])
  assert.match(de('editar_guion').description, /vuelve a pendiente/)
  assert.ok(de('crear_post').inputSchema.properties.idea_id)
})

test('aprobar_guion: aprueba y crea la tarjeta en Por grabar; deshacer la quita', async () => {
  const r = await llamar('aprobar_guion', { post_id: id(1), aprobado: true })
  assert.equal(r.post.aprobacion, 'aprobado')
  assert.ok(post(1).aprobacion_en)
  assert.equal(r.tarea.creada, true)
  assert.equal(filas.tareas.length, 1)
  const t = filas.tareas[0]
  assert.equal(t.post_id, id(1))
  assert.equal(t.columna_id, COL1)
  assert.equal(t.origen, 'produccion')
  assert.equal(t.paso, 'grabacion')
  assert.equal(t.user_id, 'u')
  assert.equal(t.titulo, 'Con guion')

  const q = await llamar('aprobar_guion', { post_id: id(1), aprobado: false })
  assert.equal(q.post.aprobacion, null)
  assert.equal(post(1).aprobacion_en, null)
  assert.equal(q.tarea.quitada, true)
  assert.equal(filas.tareas.length, 0)
})

test('aprobar_guion: no duplica la tarjeta ni quita la que ya se movió', async () => {
  filas.tareas.push({ id: id(200), post_id: id(1), origen: 'produccion', columna_id: COL2 })
  const r = await llamar('aprobar_guion', { post_id: id(1), aprobado: true })
  assert.equal(r.tarea.creada, false)
  assert.equal(filas.tareas.length, 1)
  const q = await llamar('aprobar_guion', { post_id: id(1), aprobado: false })
  assert.equal(q.tarea.quitada, false)
  assert.equal(filas.tareas.length, 1)
})

test('aprobar_guion: el tablero sin columnas nace como en la web', async () => {
  filas.tablero_columnas = []
  const r = await llamar('aprobar_guion', { post_id: id(1), aprobado: true })
  assert.equal(r.tarea.columna, 'Por grabar')
  assert.deepEqual(filas.tablero_columnas.map(c => c.nombre), ['Por grabar', 'Por editar', 'Por publicar', 'Hecho'])
  assert.equal(filas.tareas[0].columna_id, filas.tablero_columnas[0].id)
})

test('aprobar_guion: lo que no toca', async () => {
  assert.match((await llamar('aprobar_guion', { post_id: id(2), aprobado: true })).error, /no tiene guion/)
  assert.match((await llamar('aprobar_guion', { post_id: POST_AJENO, aprobado: true })).error, AJENO_ERROR)
  assert.equal(post(POST_AJENO).aprobacion_estado, null)

  // Quitar no borra los cambios que pidió el cliente
  const c = await llamar('aprobar_guion', { post_id: id(4), aprobado: false })
  assert.equal(c.sin_cambios, true)
  assert.equal(post(4).aprobacion_estado, 'cambios')

  // Ya aprobado: no se pisa la fecha
  const a = await llamar('aprobar_guion', { post_id: id(3), aprobado: true })
  assert.equal(a.sin_cambios, true)
  assert.equal(post(3).aprobacion_en, '2098-12-30T10:00:00.000Z')
  assert.equal(escrituras.length, 0)

  // Aprobar uno con cambios pedidos conserva el comentario
  await llamar('aprobar_guion', { post_id: id(4), aprobado: true })
  assert.equal(post(4).aprobacion_estado, 'aprobado')
  assert.equal(post(4).aprobacion_comentario, 'Cambia el gancho')
})

test('crear_enlace_aprobacion: crea uno y luego reutiliza el activo', async () => {
  const r = await llamar('crear_enlace_aprobacion', { cliente_id: CLIENTE, mes: '2099-01' })
  assert.equal(r.url, 'https://app.ejemplo/aprobar/token-1')
  assert.equal(r.reutilizado, false)
  assert.equal(r.guiones, 4) // los posts 1, 3, 4 y 6
  const fila = filas.guion_aprobaciones[0]
  assert.deepEqual([fila.user_id, fila.organizacion_id, fila.cliente_id, fila.anio, fila.mes], ['u', ORG, CLIENTE, 2099, 1])
  const otra = await llamar('crear_enlace_aprobacion', { cliente_id: CLIENTE, mes: '2099-01' })
  assert.equal(otra.url, r.url)
  assert.equal(otra.reutilizado, true)
  assert.equal(filas.guion_aprobaciones.length, 1)
})

test('crear_enlace_aprobacion: caducado o revocado no vale; sin guiones o ajeno, error', async () => {
  filas.guion_aprobaciones.push(
    { id: 'a', token: 'viejo', cliente_id: CLIENTE, anio: 2099, mes: 1, estado: 'activo', expira_en: '2020-01-01T00:00:00.000Z' },
    { id: 'b', token: 'revocado', cliente_id: CLIENTE, anio: 2099, mes: 1, estado: 'revocado', expira_en: '2200-01-01T00:00:00.000Z' },
  )
  const r = await llamar('crear_enlace_aprobacion', { cliente_id: CLIENTE, mes: '2099-01' })
  assert.equal(r.reutilizado, false)
  assert.match(r.url, /token-1$/)
  assert.match((await llamar('crear_enlace_aprobacion', { cliente_id: CLIENTE, mes: '2099-06' })).error, /no tiene guiones/)
  assert.match((await llamar('crear_enlace_aprobacion', { cliente_id: AJENO, mes: '2099-01' })).error, /ningún cliente/)
})

test('aprobacion_comentario sale en ver_guion y en ver_calendario', async () => {
  assert.equal((await llamar('ver_guion', { post_id: id(4) })).aprobacion_comentario, 'Cambia el gancho')
  const cal = await llamar('ver_calendario', { cliente_id: CLIENTE, mes: '2099-01' })
  assert.equal(cal.posts.find(p => p.id === id(4)).aprobacion_comentario, 'Cambia el gancho')
  assert.equal(cal.posts.find(p => p.id === id(1)).aprobacion_comentario, null)
})

test('cancelar_publicacion: programado y con error; no lo publicándose, ni lo publicado, ni lo ajeno', async () => {
  const ig = await llamar('cancelar_publicacion', { post_id: id(5), red: 'instagram' })
  assert.equal(ig.publicacion.estado, 'cancelado')
  assert.equal(filas.instagram_publicaciones[0].estado, 'cancelado')
  assert.equal(filas.tiktok_publicaciones[0].estado, 'error') // la otra red no se toca
  assert.equal((await llamar('cancelar_publicacion', { post_id: id(5), red: 'tiktok' })).publicacion.estado, 'cancelado')

  assert.match((await llamar('cancelar_publicacion', { post_id: id(6), red: 'tiktok' })).error, /Solo se puede cancelar/)
  assert.equal(filas.tiktok_publicaciones[1].estado, 'procesando')
  assert.match((await llamar('cancelar_publicacion', { post_id: id(8), red: 'instagram' })).error, /Solo se puede cancelar/)
  assert.match((await llamar('cancelar_publicacion', { post_id: POST_AJENO, red: 'instagram' })).error, AJENO_ERROR)
  assert.match((await llamar('cancelar_publicacion', { post_id: id(5), red: 'facebook' })).error, /red|Invalid/i)
})

test('ver_publicacion: lo que hace falta para reprogramar, sin campos internos', async () => {
  const r = await llamar('ver_publicacion', { post_id: id(5) })
  assert.deepEqual(r.instagram.rutas, [`${ORG}/${CLIENTE}/a.mp4`])
  assert.equal(r.instagram.caption, 'Hola')
  assert.equal(r.instagram.portada_ruta, `${ORG}/${CLIENTE}/p.jpg`)
  assert.equal(r.instagram.portada_nombre, 'p.jpg')
  assert.equal(r.instagram.es_trial, true)
  assert.equal(r.instagram.trial_graduacion, 'SS_PERFORMANCE')
  assert.equal(r.instagram.estado, 'programado')
  assert.equal(r.tiktok.privacidad, 'SELF_ONLY')
  assert.equal(r.tiktok.permitir_comentarios, true)
  assert.equal(JSON.stringify(r).includes('NO-SALIR'), false)

  const nada = await llamar('ver_publicacion', { post_id: id(2) })
  assert.equal(nada.instagram, null)
  assert.match(nada.nota, /no tiene nada programado/)
  assert.match((await llamar('ver_publicacion', { post_id: POST_AJENO })).error, AJENO_ERROR)
})

test('marcar_grabado: marca, desmarca y no toca lo ajeno', async () => {
  const r = await llamar('marcar_grabado', { post_id: id(1), grabado: true })
  assert.equal(r.post.grabado, true)
  assert.ok(post(1).grabado_en)
  await llamar('marcar_grabado', { post_id: id(1), grabado: false })
  assert.equal(post(1).grabado_en, null)
  assert.match((await llamar('marcar_grabado', { post_id: POST_AJENO, grabado: true })).error, AJENO_ERROR)
  assert.equal(post(POST_AJENO).grabado_en, undefined)
})

test('editar_post: título, formato (reel = video) y red; la idea sigue el formato', async () => {
  const r = await llamar('editar_post', { post_id: id(1), titulo: ' Nuevo ', formato: 'reel', red: 'instagram_y_tiktok' })
  assert.equal(r.post.titulo, 'Nuevo')
  assert.equal(post(1).formato, 'video')
  assert.equal(post(1).red, 'instagram')
  assert.deepEqual(post(1).comparte_en, ['tiktok'])
  assert.equal(r.aviso, undefined)
  assert.equal(filas.ideas[0].formato, 'video')

  const c = await llamar('editar_post', { post_id: id(1), formato: 'carrusel' })
  assert.equal(filas.ideas[0].formato, 'carrusel')
  assert.match(c.aviso, /formato anterior/)
  assert.deepEqual(post(1).guion, GUION())
})

test('editar_post: no en lo publicado o publicándose, ni en lo ajeno; sin campos, error', async () => {
  assert.match((await llamar('editar_post', { post_id: id(7), titulo: 'x' })).error, /ya está publicado/)
  assert.match((await llamar('editar_post', { post_id: id(8), titulo: 'x' })).error, /ya está publicado en Instagram/)
  assert.match((await llamar('editar_post', { post_id: id(6), titulo: 'x' })).error, /publicando en TikTok/)
  assert.match((await llamar('editar_post', { post_id: POST_AJENO, titulo: 'x' })).error, AJENO_ERROR)
  assert.match((await llamar('editar_post', { post_id: id(1) })).error, /nada que cambiar/)
  assert.equal(escrituras.length, 0)
})

test('editar_post: lo programado admite el título, pero no dejar colgada la publicación', async () => {
  assert.equal((await llamar('editar_post', { post_id: id(5), titulo: 'Otro' })).post.titulo, 'Otro')
  assert.match((await llamar('editar_post', { post_id: id(5), formato: 'carrusel' })).error, /cancela antes/)
  assert.match((await llamar('editar_post', { post_id: id(5), red: 'tiktok' })).error, /programado en Instagram.*cancela antes/)
  assert.equal(post(5).red, 'instagram')
  // Mismo formato o seguir en esa red: nada que proteger
  assert.equal((await llamar('editar_post', { post_id: id(5), formato: 'video', red: 'instagram' })).post.red, 'instagram')
})

test('editar_guion: cada parte se mezcla con lo que hay', async () => {
  const r = await llamar('editar_guion', {
    post_id: id(1), gancho: 'G2', problema: 'P2', promesa: 'Q2', cierre: { cta: 'C2' },
    planos: [{ segundos: '0-2', plano: 'General', visual: 'V2', dice: 'D2' }], titulo: 'T2',
  })
  assert.equal(r.guion.gancho, 'G2')
  assert.deepEqual(r.guion.problema, { texto: 'P2', segundos: '4-10' })
  assert.deepEqual(r.guion.promesa, { texto: 'Q2', segundos: '10-20' })
  assert.deepEqual(r.guion.cierre, { remate: 'R', cta: 'C2', segundos: '20-25' })
  assert.deepEqual(r.guion.contenido, GUION().contenido)
  assert.equal(r.guion.planos.length, 1)
  assert.equal(r.titulo, 'T2')
  assert.equal(post(1).titulo, 'T2')
})

test('editar_guion: sin guion lo crea con la parte enviada', async () => {
  const r = await llamar('editar_guion', { post_id: id(2), problema: 'Solo esto' })
  assert.deepEqual(r.guion, { problema: { texto: 'Solo esto' } })
})

test('editar_guion: cambiar el guion devuelve la aprobación a pendiente y lo dice; el resto no', async () => {
  const soloCopy = await llamar('editar_guion', { post_id: id(3), copy: 'c', titulo: 't', notas: 'n', hashtags: '#h' })
  assert.equal(soloCopy.aprobacion, 'aprobado')
  assert.equal(soloCopy.aviso, undefined)

  const r = await llamar('editar_guion', { post_id: id(3), gancho: 'Otro' })
  assert.equal(r.aprobacion, null)
  assert.equal(r.aprobacion_comentario, 'Genial')
  assert.match(r.aviso, /pendiente/)
  assert.equal(post(3).aprobacion_estado, null)
})

test('editar_guion: los campos nuevos respetan lo publicado', async () => {
  assert.match((await llamar('editar_guion', { post_id: id(6), gancho: 'x' })).error, /publicando en TikTok/)
  assert.match((await llamar('editar_guion', { post_id: POST_AJENO, planos: [] })).error, AJENO_ERROR)
  assert.equal(escrituras.length, 0)
})

const nuevoPost = { cliente_id: CLIENTE, fecha: '2099-03-01', hora: '12:00', formato: 'video', titulo: 'Nuevo' }
const creado = () => filas.calendario_posts.at(-1)

test('crear_post con idea_id: enlaza la idea y copia su guion', async () => {
  const r = await llamar('crear_post', { ...nuevoPost, idea_id: IDEA })
  assert.equal(r.post.origen_idea_id, IDEA)
  assert.equal(r.post.tiene_guion, true)
  assert.deepEqual(creado().guion, { gancho: 'De la idea' })
  assert.equal(creado().origen_idea_id, IDEA)
  assert.equal(creado().desarrollado, true)
})

test('crear_post con idea_id: el guion que se manda manda', async () => {
  await llamar('crear_post', { ...nuevoPost, idea_id: IDEA, guion: 'frase uno' })
  assert.deepEqual(creado().guion, { contenido: { frases: ['frase uno'] } })
  assert.equal(creado().origen_idea_id, IDEA)
})

test('crear_post con idea_id: sin guion en la idea, el de su post; y avisa', async () => {
  const r = await llamar('crear_post', { ...nuevoPost, idea_id: IDEA_DE_POST })
  assert.deepEqual(creado().guion, { gancho: 'Del post' })
  assert.match(r.aviso, /mover_post/)
  assert.ok(r.aviso.includes(id(9)))
})

test('crear_post con idea_id: idea sin guion o ajena', async () => {
  const r = await llamar('crear_post', { ...nuevoPost, idea_id: IDEA_SIN_GUION })
  assert.equal(r.post.tiene_guion, false)
  assert.equal(creado().guion, null)
  assert.equal(creado().desarrollado, undefined)
  const n = filas.calendario_posts.length
  assert.match((await llamar('crear_post', { ...nuevoPost, idea_id: IDEA_AJENA })).error, /ninguna idea/)
  assert.equal(filas.calendario_posts.length, n)
})

test('crear_post sin idea_id sigue igual', async () => {
  const r = await llamar('crear_post', nuevoPost)
  assert.equal('origen_idea_id' in creado(), false)
  assert.equal(r.aviso, undefined)
})
