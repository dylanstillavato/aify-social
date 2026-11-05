// node --test mcp/aifyos.test.js
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import Stripe from 'stripe'
import { crearAifyos, evaluarLicencia } from './aifyos.js'
import { crearOAuthMcp } from './oauth.js'

const PRECIO = 'price_aifyos'
const SECRETO = 'whsec_prueba'
const ORG = '11111111-1111-4111-8111-111111111111'

// Supabase en memoria con solo lo que usa mcp/aifyos.js
function supabaseFalso({ sinTablas = false } = {}) {
  const tablas = { aifyos_licencias: [], oauth_mcp_clientes: [] }
  const clave = { aifyos_licencias: 'organizacion_id' }
  return {
    tablas,
    from(nombre) {
      const filtros = []
      const consulta = {
        select: () => consulta,
        eq(columna, valor) { filtros.push([columna, valor]); return consulta },
        async maybeSingle() {
          if (sinTablas) return { data: null, error: { code: '42P01', message: 'no existe' } }
          return { data: tablas[nombre].find(f => filtros.every(([c, v]) => f[c] === v)) || null, error: null }
        },
        async upsert(fila) {
          if (sinTablas) return { error: { code: '42P01', message: 'no existe' } }
          const actual = tablas[nombre].find(f => f[clave[nombre]] === fila[clave[nombre]])
          if (actual) Object.assign(actual, fila)
          else tablas[nombre].push({ ...fila })
          return { error: null }
        },
        async insert(fila) { tablas[nombre].push({ ...fila }); return { error: null } },
        update(cambios) {
          return { eq: async (c, v) => { for (const f of tablas[nombre]) if (f[c] === v) Object.assign(f, cambios); return { error: null } } }
        },
      }
      return consulta
    },
  }
}

const suscripcion = (cambios = {}) => ({
  id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
  metadata: { organizacion_id: ORG },
  items: { data: [{ price: { id: PRECIO }, current_period_end: 1800000000 }] },
  ...cambios,
})

function stripeFalso(sub, llamadas = []) {
  const real = new Stripe('sk_test_falsa')
  return {
    webhooks: real.webhooks,
    subscriptions: { retrieve: async () => sub },
    customers: { create: async (d) => { llamadas.push(['cliente', d]); return { id: 'cus_nuevo' } } },
    checkout: { sessions: { create: async (d) => { llamadas.push(['checkout', d]); return { url: 'https://checkout/1' } } } },
    billingPortal: { sessions: { create: async () => ({ url: 'https://portal/1' }) } },
    real,
  }
}

const app = (s, stripe, extra = {}) => crearAifyos({ stripe, supabaseAdmin: s, priceId: PRECIO, webhookSecret: SECRETO, urlFrontend: 'https://app.test', ...extra })

function respuesta() {
  return { codigo: 200, cuerpo: null, status(c) { this.codigo = c; return this }, json(b) { this.cuerpo = b; return this }, send(b) { this.cuerpo = b; return this }, end() { return this } }
}

function peticionFirmada(stripe, evento, secreto = SECRETO) {
  const cuerpo = JSON.stringify(evento)
  const firma = stripe.real.webhooks.generateTestHeaderString({ payload: cuerpo, secret: secreto })
  return { body: Buffer.from(cuerpo), headers: { 'stripe-signature': firma } }
}

test('evaluarLicencia: vivos, cortesía y el resto', () => {
  for (const e of ['trialing', 'active', 'past_due']) assert.equal(evaluarLicencia({ subscription_status: e }).activa, true)
  for (const e of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', null]) assert.equal(evaluarLicencia({ subscription_status: e }).activa, false)
  assert.equal(evaluarLicencia(null).activa, false)
  assert.deepEqual(evaluarLicencia({ subscription_status: 'canceled', acceso_cortesia: true }), { activa: true, motivo: 'cortesia' })
})

test('webhook: firma buena activa la licencia; firma mala, 400 y no toca nada', async () => {
  const s = supabaseFalso()
  const stripe = stripeFalso(suscripcion())
  const a = app(s, stripe)
  const evento = { id: 'evt', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }

  const mala = respuesta()
  await a.webhook(peticionFirmada(stripe, evento, 'whsec_otro'), mala)
  assert.equal(mala.codigo, 400)
  assert.equal(s.tablas.aifyos_licencias.length, 0)

  const buena = respuesta()
  await a.webhook(peticionFirmada(stripe, evento), buena)
  assert.equal(buena.codigo, 200)
  assert.equal((await a.estado(ORG)).activa, true)
  assert.equal(s.tablas.aifyos_licencias[0].current_period_end, new Date(1800000000 * 1000).toISOString())
})

test('webhook: checkout completado; cancelar quita el acceso; otro precio se ignora', async () => {
  const s = supabaseFalso()
  const sub = suscripcion()
  const stripe = stripeFalso(sub)
  const a = app(s, stripe)
  await a.webhook(peticionFirmada(stripe, { id: 'e1', type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1' } } }), respuesta())
  assert.equal((await a.estado(ORG)).activa, true)

  sub.status = 'canceled'
  await a.webhook(peticionFirmada(stripe, { id: 'e2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } }), respuesta())
  assert.equal((await a.estado(ORG)).activa, false)

  const s2 = supabaseFalso()
  const stripe2 = stripeFalso(suscripcion({ items: { data: [{ price: { id: 'price_otro' } }] } }))
  await app(s2, stripe2).webhook(peticionFirmada(stripe2, { id: 'e3', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }), respuesta())
  assert.equal(s2.tablas.aifyos_licencias.length, 0)
})

test('la cortesía a mano sobrevive a una cancelación en Stripe', async () => {
  const s = supabaseFalso()
  s.tablas.aifyos_licencias.push({ organizacion_id: ORG, acceso_cortesia: true })
  const stripe = stripeFalso(suscripcion({ status: 'canceled' }))
  const a = app(s, stripe)
  await a.webhook(peticionFirmada(stripe, { id: 'e', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } }), respuesta())
  assert.deepEqual([(await a.estado(ORG)).activa, (await a.estado(ORG)).motivo], [true, 'cortesia'])
})

test('error guardando: 500 para que Stripe reintente', async () => {
  const stripe = stripeFalso(suscripcion())
  const r = respuesta()
  await app(supabaseFalso({ sinTablas: true }), stripe).webhook(peticionFirmada(stripe, { id: 'e', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }), r)
  assert.equal(r.codigo, 500)
})

test('checkout usa el precio de la variable y no deja pagar dos veces', async () => {
  const s = supabaseFalso()
  const llamadas = []
  const a = app(s, stripeFalso(suscripcion(), llamadas))
  assert.deepEqual(await a.crearCheckout({ organizacionId: ORG, email: 'a@b.c' }), { url: 'https://checkout/1' })
  const sesion = llamadas.find(([q]) => q === 'checkout')[1]
  assert.deepEqual(sesion.line_items, [{ price: PRECIO, quantity: 1 }])
  assert.equal(sesion.subscription_data.metadata.organizacion_id, ORG)

  s.tablas.aifyos_licencias[0].subscription_status = 'active'
  await assert.rejects(a.crearCheckout({ organizacionId: ORG, email: 'a@b.c' }), (e) => e.estado === 409)
  await assert.rejects(app(s, stripeFalso(suscripcion()), { priceId: undefined }).crearCheckout({ organizacionId: 'otra', email: 'x' }), (e) => e.estado === 503)
})

test('sin migración: estado responde 503 con el aviso, sin dar acceso', async () => {
  await assert.rejects(app(supabaseFalso({ sinTablas: true }), stripeFalso(suscripcion())).estado(ORG), (e) => e.estado === 503 && /0056/.test(e.message))
})

test('el registro dinámico acepta la vuelta de AifyOS en https y rechaza http fuera de localhost', async () => {
  const oauth = crearOAuthMcp({
    supabaseAdmin: supabaseFalso(),
    urlMcp: 'https://aify-backend.onrender.com/mcp',
    urlServidor: 'https://aify-backend.onrender.com',
    urlFrontend: 'https://www.useaify.app',
    miembroDeOrganizacion: async () => null,
  })
  const registrar = (uri) => oauth.provider.clientsStore.registerClient({ client_id: 'c1', client_name: 'AifyOS', redirect_uris: [uri], grant_types: ['authorization_code', 'refresh_token'], token_endpoint_auth_method: 'none' })
  for (const uri of ['https://os.useaify.app/api/aify/callback', 'https://app.useaify.app/api/aify/callback', 'http://localhost:4100/api/aify/callback']) {
    assert.deepEqual((await registrar(uri)).redirect_uris, [uri])
  }
  await assert.rejects(registrar('http://app.useaify.app/api/aify/callback'))
})
