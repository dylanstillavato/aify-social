import crypto from 'node:crypto'
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js'
import {
  InvalidClientMetadataError, InvalidGrantError, InvalidTargetError, InvalidTokenError, ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'

// ── OAuth del MCP de Aify (0055_oauth_mcp.sql, docs/mcp.md) ───────────────────
// claude.ai, Claude Desktop y ChatGPT añaden el conector con solo la URL
// /mcp: descubren este servidor de autorización (metadatos .well-known), se
// registran solos (registro dinámico), mandan al usuario a la pantalla
// «Permitir» de Aify (src/pages/AutorizarMcp.jsx, con su sesión de Supabase)
// y canjean el código (con PKCE S256) por un token de acceso de 1 h con token
// de refresco. Las rutas y las comprobaciones de OAuth las pone el SDK
// (mcpAuthRouter); aquí solo está el almacén en Supabase.
//
// - Todos los clientes son públicos (sin client_secret): PKCE es obligatorio
//   y así no hay secretos que guardar.
// - Códigos y tokens se guardan con sha256, nunca en claro.
// - El token queda ligado a la organización de quien pulsa «Permitir» y deja
//   de valer si esa persona sale de la organización o si se revoca desde
//   Configuración → Tu IA → Apps conectadas.
// - Los tokens solo valen para este MCP (resource = la URL de /mcp).

export const SEGUNDOS_TOKEN_ACCESO = 60 * 60
const SEGUNDOS_TOKEN_REFRESCO = 60 * 24 * 60 * 60
const SEGUNDOS_SOLICITUD = 10 * 60
const ALCANCE = 'aify'

const PREFIJO_ACCESO = 'aifyat_'
const PREFIJO_REFRESCO = 'aifyrt_'
const PREFIJO_CODIGO = 'aifyac_'

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const generar = (prefijo) => prefijo + crypto.randomBytes(32).toString('base64url')
const enSegundos = (segundos) => new Date(Date.now() + segundos * 1000).toISOString()
const caducado = (iso) => !iso || new Date(iso).getTime() <= Date.now()

const esTablaInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')
export const MENSAJE_SIN_MIGRACION_OAUTH = 'Falta aplicar la migración 0055 para conectar Aify con OAuth.'

// URL canónica para comparar recursos: sin fragmento ni barra final, con
// esquema y host en minúsculas (RFC 8707 y la especificación de MCP)
function canonica(url) {
  try {
    const u = new URL(String(url))
    u.hash = ''
    return u.href.replace(/\/$/, '')
  } catch {
    return null
  }
}

// La especificación de MCP: https o localhost (con cualquier puerto, RFC 8252)
function redireccionValida(uri) {
  try {
    const u = new URL(uri)
    if (u.hash) return false
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
}

export function crearOAuthMcp({ supabaseAdmin, urlMcp, urlServidor, urlFrontend, miembroDeOrganizacion }) {
  const recurso = canonica(urlMcp)
  const fallo = (error, que) => {
    if (esTablaInexistente(error)) throw new ServerError(MENSAJE_SIN_MIGRACION_OAUTH)
    console.error(`[oauth-mcp] error con ${que}:`, error.message)
    throw new ServerError('Error de base de datos')
  }

  const clientsStore = {
    async getClient(clientId) {
      if (typeof clientId !== 'string' || clientId.length > 100) return undefined
      const { data, error } = await supabaseAdmin
        .from('oauth_mcp_clientes')
        .select('client_id, nombre, redirect_uris, metadatos, creado_en')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) fallo(error, 'el cliente OAuth')
      if (!data) return undefined
      return {
        ...(data.metadatos || {}),
        client_id: data.client_id,
        client_name: data.nombre || undefined,
        redirect_uris: data.redirect_uris || [],
        token_endpoint_auth_method: 'none',
        client_id_issued_at: Math.floor(new Date(data.creado_en).getTime() / 1000),
      }
    },

    async registerClient(cliente) {
      const uris = cliente.redirect_uris || []
      if (!uris.length || uris.length > 10) throw new InvalidClientMetadataError('Hace falta de 1 a 10 redirect_uris')
      const mala = uris.find(u => !redireccionValida(u))
      if (mala) throw new InvalidClientMetadataError(`redirect_uri no permitida (usa https o localhost): ${mala}`)
      const tiposConcesion = cliente.grant_types || ['authorization_code', 'refresh_token']
      if (!tiposConcesion.includes('authorization_code')) throw new InvalidClientMetadataError('El cliente tiene que usar authorization_code')

      // Cliente público: el SDK ha generado un client_secret que no se guarda ni se devuelve
      const resto = { ...cliente }
      delete resto.client_secret
      delete resto.client_secret_expires_at
      const metadatos = {
        grant_types: tiposConcesion,
        response_types: ['code'],
        ...(resto.client_uri ? { client_uri: resto.client_uri } : {}),
        ...(resto.logo_uri ? { logo_uri: resto.logo_uri } : {}),
        ...(resto.software_id ? { software_id: resto.software_id } : {}),
        ...(resto.software_version ? { software_version: resto.software_version } : {}),
      }
      const nombre = typeof resto.client_name === 'string' ? resto.client_name.trim().slice(0, 100) : null
      const { error } = await supabaseAdmin.from('oauth_mcp_clientes').insert({
        client_id: resto.client_id,
        nombre: nombre || null,
        redirect_uris: uris,
        metadatos,
      })
      if (error) fallo(error, 'el registro del cliente OAuth')
      return { ...resto, ...metadatos, client_name: nombre || undefined, token_endpoint_auth_method: 'none' }
    },
  }

  function comprobarRecurso(resource) {
    if (resource && canonica(resource) !== recurso) {
      throw new InvalidTargetError(`Este servidor solo da tokens para ${recurso}`)
    }
  }

  // Par nuevo de tokens: en la base solo van sus hashes
  function emitirTokens() {
    const acceso = generar(PREFIJO_ACCESO)
    const refresco = generar(PREFIJO_REFRESCO)
    return {
      fila: {
        access_hash: hashToken(acceso),
        access_caduca_en: enSegundos(SEGUNDOS_TOKEN_ACCESO),
        refresh_hash: hashToken(refresco),
        refresh_caduca_en: enSegundos(SEGUNDOS_TOKEN_REFRESCO),
      },
      respuesta: { access_token: acceso, token_type: 'Bearer', expires_in: SEGUNDOS_TOKEN_ACCESO, refresh_token: refresco, scope: ALCANCE },
    }
  }

  // Quien autorizó sigue en la organización a la que dio acceso
  async function sigueEnLaOrganizacion(userId, organizacionId) {
    const miembro = userId ? await miembroDeOrganizacion(userId) : null
    return Boolean(miembro && miembro.organizacion_id === organizacionId)
  }

  const provider = {
    clientsStore,

    // Guarda la solicitud y manda al usuario a la pantalla «Permitir» de Aify
    async authorize(cliente, params, res) {
      comprobarRecurso(params.resource)
      const { data, error } = await supabaseAdmin
        .from('oauth_mcp_autorizaciones')
        .insert({
          client_id: cliente.client_id,
          redirect_uri: params.redirectUri,
          code_challenge: params.codeChallenge,
          scopes: [ALCANCE],
          state: params.state ?? null,
          resource: recurso,
          caduca_en: enSegundos(SEGUNDOS_SOLICITUD),
        })
        .select('id')
        .single()
      if (error) fallo(error, 'la solicitud de autorización')
      res.redirect(302, `${urlFrontend}/autorizar-mcp?solicitud=${encodeURIComponent(data.id)}`)
    },

    async challengeForAuthorizationCode(cliente, codigo) {
      const { data, error } = await supabaseAdmin
        .from('oauth_mcp_autorizaciones')
        .select('code_challenge, client_id, caduca_en, usada_en')
        .eq('codigo_hash', hashToken(String(codigo)))
        .maybeSingle()
      if (error) fallo(error, 'el código')
      if (!data || data.client_id !== cliente.client_id || data.usada_en || caducado(data.caduca_en)) {
        throw new InvalidGrantError('Código no válido o caducado')
      }
      return data.code_challenge
    },

    async exchangeAuthorizationCode(cliente, codigo, _verificador, redirectUri, resource) {
      comprobarRecurso(resource)
      // Un solo uso: se marca como usado en la misma actualización que lo busca
      const { data, error } = await supabaseAdmin
        .from('oauth_mcp_autorizaciones')
        .update({ usada_en: new Date().toISOString() })
        .eq('codigo_hash', hashToken(String(codigo)))
        .eq('client_id', cliente.client_id)
        .is('usada_en', null)
        .select('id, redirect_uri, user_id, organizacion_id, caduca_en')
      if (error) fallo(error, 'el código')
      const fila = data?.[0]
      if (!fila || caducado(fila.caduca_en) || !fila.user_id) throw new InvalidGrantError('Código no válido o caducado')
      if (redirectUri && redirectUri !== fila.redirect_uri) throw new InvalidGrantError('redirect_uri no coincide con la de la autorización')
      if (!(await sigueEnLaOrganizacion(fila.user_id, fila.organizacion_id))) throw new InvalidGrantError('Quien autorizó ya no está en la organización')

      const tokens = emitirTokens()
      const { error: errorToken } = await supabaseAdmin.from('oauth_mcp_tokens').insert({
        client_id: cliente.client_id,
        user_id: fila.user_id,
        organizacion_id: fila.organizacion_id,
        scopes: [ALCANCE],
        resource: recurso,
        ...tokens.fila,
      })
      if (errorToken) fallo(errorToken, 'el token')
      return tokens.respuesta
    },

    // Rota el token de refresco (obligatorio para clientes públicos)
    async exchangeRefreshToken(cliente, refreshToken, _scopes, resource) {
      comprobarRecurso(resource)
      const viejo = hashToken(String(refreshToken))
      const { data: fila, error } = await supabaseAdmin
        .from('oauth_mcp_tokens')
        .select('id, client_id, user_id, organizacion_id, refresh_caduca_en, revocado_en')
        .eq('refresh_hash', viejo)
        .maybeSingle()
      if (error) fallo(error, 'el token de refresco')
      if (!fila || fila.client_id !== cliente.client_id || fila.revocado_en || caducado(fila.refresh_caduca_en)) {
        throw new InvalidGrantError('Token de refresco no válido o caducado')
      }
      if (!(await sigueEnLaOrganizacion(fila.user_id, fila.organizacion_id))) throw new InvalidGrantError('Quien autorizó ya no está en la organización')

      const tokens = emitirTokens()
      const { data: rotado, error: errorRotar } = await supabaseAdmin
        .from('oauth_mcp_tokens')
        .update(tokens.fila)
        .eq('id', fila.id)
        .eq('refresh_hash', viejo)
        .is('revocado_en', null)
        .select('id')
      if (errorRotar) fallo(errorRotar, 'el token de refresco')
      if (!rotado?.length) throw new InvalidGrantError('Token de refresco ya usado')
      return tokens.respuesta
    },

    async verifyAccessToken(token) {
      if (typeof token !== 'string' || !token.startsWith(PREFIJO_ACCESO)) throw new InvalidTokenError('Token no válido')
      const { data: fila, error } = await supabaseAdmin
        .from('oauth_mcp_tokens')
        .select('id, client_id, user_id, organizacion_id, scopes, resource, access_caduca_en, revocado_en, ultimo_uso_en')
        .eq('access_hash', hashToken(token))
        .maybeSingle()
      if (error) fallo(error, 'el token')
      if (!fila || fila.revocado_en) throw new InvalidTokenError('Token no válido o revocado')
      if (caducado(fila.access_caduca_en)) throw new InvalidTokenError('Token caducado')
      return {
        token,
        clientId: fila.client_id,
        scopes: fila.scopes || [],
        expiresAt: Math.floor(new Date(fila.access_caduca_en).getTime() / 1000),
        resource: fila.resource ? new URL(fila.resource) : undefined,
        extra: { tokenId: fila.id, userId: fila.user_id, organizacionId: fila.organizacion_id, ultimoUsoEn: fila.ultimo_uso_en },
      }
    },

    async revokeToken(cliente, { token }) {
      const hash = hashToken(String(token))
      const ahora = new Date().toISOString()
      for (const columna of ['access_hash', 'refresh_hash']) {
        const { error } = await supabaseAdmin
          .from('oauth_mcp_tokens')
          .update({ revocado_en: ahora })
          .eq(columna, hash)
          .eq('client_id', cliente.client_id)
          .is('revocado_en', null)
        if (error) fallo(error, 'la revocación')
      }
    },
  }

  // ── Pantalla «Permitir» (src/pages/AutorizarMcp.jsx) ──────────────────────
  // Errores para el frontend: { estado, error }
  const errorWeb = (estado, error) => Object.assign(new Error(error), { estado })

  async function solicitudPendiente(id) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw errorWeb(400, 'Enlace de autorización no válido.')
    const { data, error } = await supabaseAdmin
      .from('oauth_mcp_autorizaciones')
      .select('id, client_id, redirect_uri, state, caduca_en, aprobada_en, usada_en')
      .eq('id', id)
      .maybeSingle()
    if (esTablaInexistente(error)) throw errorWeb(503, MENSAJE_SIN_MIGRACION_OAUTH)
    if (error) throw errorWeb(500, 'No se pudo leer la solicitud. Inténtalo de nuevo.')
    if (!data) throw errorWeb(404, 'Esta solicitud no existe. Vuelve a conectar Aify desde tu IA.')
    if (data.aprobada_en || data.usada_en) throw errorWeb(410, 'Esta solicitud ya se ha respondido. Vuelve a conectar Aify desde tu IA si hace falta.')
    if (caducado(data.caduca_en)) throw errorWeb(410, 'Esta solicitud ha caducado (10 minutos). Vuelve a conectar Aify desde tu IA.')
    return data
  }

  // Lo que enseña la pantalla: quién pide acceso y a dónde volverá
  async function verSolicitud(id, userId) {
    const solicitud = await solicitudPendiente(id)
    const cliente = await clientsStore.getClient(solicitud.client_id)
    const miembro = await miembroDeOrganizacion(userId)
    if (!miembro) throw errorWeb(400, 'Tu cuenta no tiene organización en Aify todavía. Termina de crear tu cuenta y vuelve a intentarlo.')
    const { data: org } = await supabaseAdmin.from('organizaciones').select('nombre').eq('id', miembro.organizacion_id).maybeSingle()
    return {
      cliente: cliente?.client_name || 'Una aplicación',
      sitio: new URL(solicitud.redirect_uri).host,
      organizacion: org?.nombre || null,
      caduca_en: solicitud.caduca_en,
    }
  }

  // «Permitir» crea el código de un solo uso; «Cancelar» devuelve access_denied.
  // En los dos casos el frontend lleva al usuario a redirigir_a.
  async function responderSolicitud(id, userId, permitir) {
    const solicitud = await solicitudPendiente(id)
    const destino = new URL(solicitud.redirect_uri)
    if (solicitud.state) destino.searchParams.set('state', solicitud.state)

    if (!permitir) {
      await supabaseAdmin.from('oauth_mcp_autorizaciones').update({ usada_en: new Date().toISOString() }).eq('id', solicitud.id).is('usada_en', null)
      destino.searchParams.set('error', 'access_denied')
      destino.searchParams.set('error_description', 'El usuario no ha dado acceso')
      return { redirigir_a: destino.href }
    }

    const miembro = await miembroDeOrganizacion(userId)
    if (!miembro) throw errorWeb(400, 'Tu cuenta no tiene organización en Aify todavía.')
    const codigo = generar(PREFIJO_CODIGO)
    const { data, error } = await supabaseAdmin
      .from('oauth_mcp_autorizaciones')
      .update({
        codigo_hash: hashToken(codigo),
        user_id: userId,
        organizacion_id: miembro.organizacion_id,
        aprobada_en: new Date().toISOString(),
        caduca_en: enSegundos(SEGUNDOS_SOLICITUD),
      })
      .eq('id', solicitud.id)
      .is('aprobada_en', null)
      .is('usada_en', null)
      .select('id')
    if (error) throw errorWeb(500, 'No se pudo guardar la autorización. Inténtalo de nuevo.')
    if (!data?.length) throw errorWeb(410, 'Esta solicitud ya se ha respondido.')
    destino.searchParams.set('code', codigo)
    return { redirigir_a: destino.href }
  }

  // ── Apps conectadas (Configuración → Tu IA) ──────────────────────────────
  async function listarApps(organizacionId) {
    const { data, error } = await supabaseAdmin
      .from('oauth_mcp_tokens')
      .select('id, client_id, user_id, creado_en, ultimo_uso_en, refresh_caduca_en')
      .eq('organizacion_id', organizacionId)
      .is('revocado_en', null)
      .order('creado_en', { ascending: false })
    if (esTablaInexistente(error)) return { apps: [], sinMigracion: true }
    if (error) throw errorWeb(500, 'No se pudieron cargar las apps conectadas')
    const vivas = (data || []).filter(t => !caducado(t.refresh_caduca_en))
    const ids = [...new Set(vivas.map(t => t.client_id))]
    const nombres = new Map()
    if (ids.length) {
      const { data: clientes } = await supabaseAdmin.from('oauth_mcp_clientes').select('client_id, nombre').in('client_id', ids)
      for (const c of clientes || []) nombres.set(c.client_id, c.nombre)
    }
    return {
      apps: vivas.map(t => ({ id: t.id, nombre: nombres.get(t.client_id) || 'App sin nombre', user_id: t.user_id, conectada_en: t.creado_en, ultimo_uso_en: t.ultimo_uso_en })),
    }
  }

  async function revocarApp(id, organizacionId) {
    const { data, error } = await supabaseAdmin
      .from('oauth_mcp_tokens')
      .update({ revocado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('organizacion_id', organizacionId)
      .is('revocado_en', null)
      .select('id')
    if (esTablaInexistente(error)) throw errorWeb(503, MENSAJE_SIN_MIGRACION_OAUTH)
    if (error) throw errorWeb(500, 'No se pudo desconectar la app. Inténtalo de nuevo.')
    if (!data?.length) throw errorWeb(404, 'No se encontró esa app')
  }

  async function datosApp(id, organizacionId) {
    const { data, error } = await supabaseAdmin.from('oauth_mcp_tokens').select('id, user_id').eq('id', id).eq('organizacion_id', organizacionId).maybeSingle()
    if (esTablaInexistente(error)) throw errorWeb(503, MENSAJE_SIN_MIGRACION_OAUTH)
    if (error || !data) throw errorWeb(404, 'No se encontró esa app')
    return data
  }

  // Último uso como mucho una vez por minuto; si falla, no corta la petición
  function apuntarUso(info) {
    const { tokenId, ultimoUsoEn } = info.extra || {}
    if (ultimoUsoEn && Date.now() - new Date(ultimoUsoEn).getTime() < 60 * 1000) return
    supabaseAdmin.from('oauth_mcp_tokens').update({ ultimo_uso_en: new Date().toISOString() }).eq('id', tokenId)
      .then(({ error }) => { if (error) console.error('[oauth-mcp] error guardando el último uso:', error.message) })
  }

  const urlMetadatosRecurso = getOAuthProtectedResourceMetadataUrl(new URL(urlMcp))

  // Rutas de OAuth del SDK (/authorize, /token, /register, /revoke y los
  // .well-known) más los metadatos del recurso también en la raíz.
  function montar(app) {
    const router = mcpAuthRouter({
      provider,
      issuerUrl: new URL(urlServidor),
      resourceServerUrl: new URL(urlMcp),
      scopesSupported: [ALCANCE],
      resourceName: 'Aify',
      serviceDocumentationUrl: new URL('https://github.com/dylanstillavato/aify-social/blob/main/docs/mcp.md'),
    })
    app.use(router)
    app.use('/.well-known/oauth-protected-resource', metadataHandler({
      resource: recurso,
      authorization_servers: [new URL(urlServidor).href],
      scopes_supported: [ALCANCE],
      resource_name: 'Aify',
    }))
  }

  return {
    provider, montar, recurso, urlMetadatosRecurso, alcance: ALCANCE,
    esDeEsteRecurso: (r) => canonica(r) === recurso,
    sigueEnLaOrganizacion, apuntarUso,
    verSolicitud, responderSolicitud, listarApps, revocarApp, datosApp,
  }
}
