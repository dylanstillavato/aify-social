import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import * as z from 'zod'
import crypto from 'node:crypto'

// ── MCP de Aify (docs/mcp.md) ─────────────────────────────────────────────────
// Claude (Claude Code, Claude Desktop o claude.ai) usa Aify con herramientas.
// Transporte Streamable HTTP sin estado: un McpServer nuevo por petición.
// Se autentica con una clave de API (requireClaveApi, 0046_claves_api.sql),
// que deja req.organizacionId. supabaseAdmin se salta RLS, así que TODAS las
// herramientas filtran por esa organización: los posts y las ideas, a través
// de su cliente (clienteDeOrganizacion).
//
// server.js llama a montarMcp(app, ...) pasándole sus dependencias, para no
// importar server.js desde aquí (arrancaría el servidor otra vez).
//
// Herramientas de escritura (parte 3/3): crean y mueven ideas y posts, piden
// URLs de subida al bucket y programan en Instagram con la misma función que
// el endpoint de la web (programarPublicacion). No hay herramientas de borrar.
//
// TikTok (fase 3, docs/tiktok-plan.md): crear_post, ver_calendario,
// mover_post y marcar_publicado tienen en cuenta la red; ver_metricas suma lo
// de TikTok; ver_creador_tiktok y programar_tiktok usan las mismas funciones
// que la web (creadorTikTok y programarPublicacionTikTok).

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const FECHA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const idSchema = (descripcion) => z.guid().describe(descripcion)
const mesSchema = z.string().regex(MES_RE, 'El mes tiene que ir como YYYY-MM, por ejemplo 2026-11')
const fechaSchema = z.string().regex(FECHA_RE, 'La fecha tiene que ir como YYYY-MM-DD, por ejemplo 2026-11-05').describe('Fecha en formato YYYY-MM-DD')
const horaSchema = z.string().regex(HORA_RE, 'La hora tiene que ir como HH:MM, por ejemplo 18:30').describe('Hora en formato HH:MM (hora de España)')

// Formatos de un post como los guarda el calendario (src/utils/formato.js,
// FORMATOS_POST): el reel se guarda como 'video'
const FORMATOS_POST = ['video', 'carrusel', 'historia']
const formatoPostSchema = z.enum([...FORMATOS_POST, 'reel']).transform(f => (f === 'reel' ? 'video' : f))

// Subidas al bucket "publicaciones": lo mismo que acepta el navegador
// (PublicarInstagram.jsx sube los vídeos en mp4 y las imágenes en jpg)
const TIPOS_SUBIDA = { 'video/mp4': { ext: 'mp4', tipo: 'video' }, 'image/jpeg': { ext: 'jpg', tipo: 'imagen' } }
const tipoArchivoDeRuta = (ruta) => (/\.(mp4|mov)$/i.test(ruta) ? 'video' : /\.jpe?g$/i.test(ruta) ? 'imagen' : null)

// Dónde se publica un post, como «Nuevo post» en la web (CalendarioPublicacion.jsx,
// REDES_POST): los dos = red instagram + comparte_en tiktok.
const REDES_POST = {
  instagram: { red: 'instagram', comparte_en: [] },
  tiktok: { red: 'tiktok', comparte_en: [] },
  instagram_y_tiktok: { red: 'instagram', comparte_en: ['tiktok'] },
}
const esDeRed = (post, red) => post.red === red || (Array.isArray(post.comparte_en) && post.comparte_en.includes(red))

// Privacidades de TikTok (creator_info) y cómo se llaman en la web (services/tiktok.js)
const PRIVACIDADES_TIKTOK = {
  PUBLIC_TO_EVERYONE: 'Todo el mundo',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos (seguidores mutuos)',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  SELF_ONLY: 'Solo yo',
}

// Guion de un post: el objeto que usa Aify (gancho, contenido.frases, cierre…)
// o un texto, que se guarda como frases del desarrollo
const guionSchema = z.union([
  z.string().min(1),
  z.object({
    gancho: z.string().optional(),
    problema: z.object({ texto: z.string() }).partial().optional(),
    promesa: z.object({ texto: z.string() }).partial().optional(),
    contenido: z.object({ frases: z.array(z.string()) }).partial().optional(),
    cierre: z.object({ remate: z.string(), cta: z.string() }).partial().optional(),
    duracion_total: z.string().optional(),
  }).passthrough(),
])
const guionParaDB = (guion) => (typeof guion === 'string'
  ? { contenido: { frases: guion.split(/\n+/).map(l => l.trim()).filter(Boolean) } }
  : guion)

// "YYYY-MM-DD" + "HH:MM" en hora de España → ISO (el calendario de la web
// usa la hora del navegador; los clientes de Aify están en España)
const ZONA_HORARIA = 'Europe/Madrid'
function isoDesdeHoraEspaña(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const comoUtc = Date.UTC(a, m - 1, d, h, min)
  const desfase = (instante) => {
    const nombre = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, timeZoneName: 'longOffset' })
      .formatToParts(new Date(instante)).find(p => p.type === 'timeZoneName')?.value || 'GMT'
    const [, signo, hh, mm] = nombre.match(/GMT([+-])(\d{2}):?(\d{2})?/) || [null, '+', '0', '0']
    return (signo === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm || 0)) * 60000
  }
  // Dos pasadas por si el desfase cambia justo en el cambio de hora
  let instante = comoUtc - desfase(comoUtc)
  instante = comoUtc - desfase(instante)
  return new Date(instante).toISOString()
}

// Error con mensaje para Claude (se devuelve tal cual con isError)
class ErrorMcp extends Error {}

const texto = (datos) => ({ content: [{ type: 'text', text: typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2) }] })

// Envuelve cada herramienta: los ErrorMcp salen tal cual, el resto con un
// mensaje genérico (el detalle solo va al log del servidor)
const herramienta = (nombre, fn) => async (args) => {
  try {
    return texto(await fn(args))
  } catch (err) {
    if (!(err instanceof ErrorMcp)) console.error(`[mcp] ${nombre}:`, err.message)
    return { ...texto(err instanceof ErrorMcp ? err.message : 'Error inesperado en Aify. Inténtalo de nuevo.'), isError: true }
  }
}

const comprobar = (error, que) => {
  if (error) {
    console.error(`[mcp] error leyendo ${que}:`, error.message)
    throw new ErrorMcp(`No se pudieron leer ${que} de Aify. Inténtalo de nuevo.`)
  }
}

// La tabla o la columna aún no existe (migración sin aplicar)
const esTablaInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')
const esColumnaInexistente = (error) => error && (error.code === '42703' || error.code === 'PGRST204')

const redesActivas = (redes) => (redes && typeof redes === 'object' && !Array.isArray(redes)
  ? Object.keys(redes).filter(k => redes[k]?.activa)
  : (Array.isArray(redes) ? redes : []))

function rangoMes(mes) {
  const [anio, m] = mes.split('-').map(Number)
  const siguiente = m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, '0')}`
  return { desde: `${mes}-01`, hasta: `${siguiente}-01` }
}

// Campos del perfil del cliente que ve Claude (sin feed_token, cuota ni contacto)
const CAMPOS_PERFIL = [
  'sector', 'sector_custom', 'web', 'descripcion', 'diferencial', 'ubicacion', 'ticket_medio',
  'audiencia', 'publico_objetivo', 'que_buscan', 'por_que_elegirnos', 'rango_precio',
  'tono', 'tono_descripcion', 'energia', 'voz_genero', 'uso_emojis', 'estilo_texto', 'prohibido',
  'redes_enlaces', 'temas', 'barreras_internas', 'barreras_externas', 'competidores', 'referencias',
  'frecuencia', 'voz_cliente', 'marca_personal', 'fechas_clave', 'identidad_visual', 'perfil_comunicacion',
]

export function crearServidorMcp(dependencias, { organizacionId, userId }) {
  const { supabaseAdmin, programarPublicacion, bucketPublicaciones } = dependencias
  const {
    programarPublicacionTikTok, moverPublicacionTikTok, creadorTikTok, conexionTikTok, tiktokConfigurado,
    tiktokAuditada, permisoPublicarTikTok,
  } = dependencias
  const servidor = new McpServer({ name: 'aify', version: '1.0.0' })

  async function clienteDeOrganizacion(clienteId, columnas = '*') {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select(columnas)
      .eq('id', clienteId)
      .eq('organizacion_id', organizacionId)
      .maybeSingle()
    comprobar(error, 'el cliente')
    if (!data) throw new ErrorMcp('No hay ningún cliente con ese id en tu organización. Usa listar_clientes para ver los ids.')
    return data
  }

  async function postDeOrganizacion(postId) {
    const { data: post, error } = await supabaseAdmin.from('calendario_posts').select('*').eq('id', postId).maybeSingle()
    comprobar(error, 'el post')
    if (!post) throw new ErrorMcp('No hay ningún post con ese id en tu organización.')
    const cliente = await clienteDeOrganizacion(post.cliente_id, 'id, nombre').catch(() => null)
    if (!cliente) throw new ErrorMcp('No hay ningún post con ese id en tu organización.')
    return { post, cliente }
  }

  servidor.registerTool('listar_clientes', {
    title: 'Listar clientes',
    description: 'Lista los clientes de la organización: id, nombre, sector y redes activas. Usa el id en el resto de herramientas.',
    annotations: { readOnlyHint: true },
  }, herramienta('listar_clientes', async () => {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('organizacion_id', organizacionId)
      .order('nombre', { ascending: true })
    comprobar(error, 'los clientes')
    return (data || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      sector: c.sector_custom || c.sector || null,
      redes: redesActivas(c.redes),
      archivado: Boolean(c.archivado),
    }))
  }))

  servidor.registerTool('ver_cliente', {
    title: 'Ver cliente',
    description: 'Perfil de un cliente: a qué se dedica, audiencia, diferencial, tono, lo que está prohibido decir, temas, competidores…',
    inputSchema: { cliente_id: idSchema('id del cliente (de listar_clientes)') },
    annotations: { readOnlyHint: true },
  }, herramienta('ver_cliente', async ({ cliente_id }) => {
    const cliente = await clienteDeOrganizacion(cliente_id)
    const perfil = { id: cliente.id, nombre: cliente.nombre, redes: redesActivas(cliente.redes) }
    for (const campo of CAMPOS_PERFIL) {
      const valor = cliente[campo]
      const vacio = valor == null || valor === '' || (Array.isArray(valor) && !valor.length) || (typeof valor === 'object' && !Array.isArray(valor) && !Object.keys(valor).length)
      if (!vacio) perfil[campo] = valor
    }
    return perfil
  }))

  servidor.registerTool('ver_calendario', {
    title: 'Ver calendario',
    description: 'Posts de un cliente en un mes: fecha, hora, red (y comparte_en), formato, título, estado, si tiene guion y su programación en Instagram y en TikTok. También los guiones del mes que aún no tienen fecha (guiones_sin_programar). Con red, solo los posts que salen en esa red.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      mes: mesSchema.describe('Mes en formato YYYY-MM'),
      red: z.enum(['instagram', 'tiktok']).optional().describe('Solo los posts de esta red (opcional; por defecto, todos)'),
    },
    annotations: { readOnlyHint: true },
  }, herramienta('ver_calendario', async ({ cliente_id, mes, red }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const { desde, hasta } = rangoMes(mes)
    const { data: posts, error } = await supabaseAdmin
      .from('calendario_posts')
      .select('*')
      .eq('cliente_id', cliente.id)
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: true })
    comprobar(error, 'el calendario')
    const delMes = red ? (posts || []).filter(p => esDeRed(p, red)) : (posts || [])

    // Programación en Instagram (0036) y en TikTok (0049); si la tabla no está, sin datos
    const porPost = {}
    const porPostTikTok = {}
    if (delMes.length) {
      const ids = delMes.map(p => p.id)
      const [{ data: publicaciones, error: errorPub }, { data: publicacionesTikTok, error: errorTikTok }] = await Promise.all([
        supabaseAdmin.from('instagram_publicaciones')
          .select('post_id, tipo, estado, publicar_en, publicado_en, permalink, error')
          .in('post_id', ids),
        supabaseAdmin.from('tiktok_publicaciones')
          .select('post_id, tipo, estado, estado_tiktok, privacidad, publicar_en, publicado_en, enlace, error')
          .in('post_id', ids),
      ])
      if (errorPub && !esTablaInexistente(errorPub)) comprobar(errorPub, 'las publicaciones de Instagram')
      if (errorTikTok && !esTablaInexistente(errorTikTok)) comprobar(errorTikTok, 'las publicaciones de TikTok')
      for (const p of publicaciones || []) porPost[p.post_id] = p
      for (const p of publicacionesTikTok || []) porPostTikTok[p.post_id] = p
    }

    const resumen = (p, conFecha = true) => {
      const pub = porPost[p.id]
      const pubTikTok = porPostTikTok[p.id]
      return {
        id: p.id,
        ...(conFecha ? { fecha: p.fecha, hora: p.hora ? String(p.hora).slice(0, 5) : null } : {}),
        red: p.red,
        comparte_en: Array.isArray(p.comparte_en) && p.comparte_en.length ? p.comparte_en : undefined,
        formato: p.formato,
        titulo: p.titulo,
        estado: p.estado,
        aprobacion: p.aprobacion_estado || null,
        grabado: Boolean(p.grabado_en),
        tiene_guion: Boolean(p.guion),
        instagram: pub
          ? { programado: pub.estado === 'programado' || pub.estado === 'procesando', estado: pub.estado, tipo: pub.tipo, publicar_en: pub.publicar_en, publicado_en: pub.publicado_en, enlace: pub.permalink, error: pub.error }
          : null,
        tiktok: pubTikTok
          ? {
            programado: pubTikTok.estado === 'programado' || pubTikTok.estado === 'procesando', estado: pubTikTok.estado, estado_tiktok: pubTikTok.estado_tiktok,
            tipo: pubTikTok.tipo, privacidad: pubTikTok.privacidad, publicar_en: pubTikTok.publicar_en, publicado_en: pubTikTok.publicado_en, enlace: pubTikTok.enlace, error: pubTikTok.error,
          }
          : null,
      }
    }
    // en_calendario = false (0030): guiones del mes sin fecha; su fecha es el día 1
    const enCalendario = delMes.filter(p => p.en_calendario !== false)
    const sinProgramar = delMes.filter(p => p.en_calendario === false)
    return {
      cliente: cliente.nombre,
      mes,
      ...(red ? { red } : {}),
      posts: enCalendario.map(p => resumen(p)),
      guiones_sin_programar: sinProgramar.map(p => resumen(p, false)),
    }
  }))

  servidor.registerTool('listar_ideas', {
    title: 'Listar ideas',
    description: 'Ideas guardadas de un cliente (de la Lluvia de ideas): título, concepto, formato y si ya tienen guion. Opcionalmente, solo las de un mes.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      mes: mesSchema.optional().describe('Mes en formato YYYY-MM (opcional)'),
    },
    annotations: { readOnlyHint: true },
  }, herramienta('listar_ideas', async ({ cliente_id, mes }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const consulta = () => supabaseAdmin.from('ideas').select('*').eq('cliente_id', cliente.id).order('creada_en', { ascending: false }).limit(200)
    let { data: ideas, error } = await (mes ? consulta().eq('mes', `${mes}-01`) : consulta())
    // Sin la columna mes (0045), se filtra por la fecha de creación
    if (mes && esColumnaInexistente(error)) {
      const { desde, hasta } = rangoMes(mes)
      ;({ data: ideas, error } = await consulta().gte('creada_en', desde).lt('creada_en', hasta))
    }
    comprobar(error, 'las ideas')

    // Los guiones viven en calendario_posts (origen_idea_id, ver 0030)
    const conGuion = new Set((ideas || []).filter(i => i.guion).map(i => i.id))
    if (ideas?.length) {
      const { data: posts, error: errorPosts } = await supabaseAdmin
        .from('calendario_posts')
        .select('origen_idea_id')
        .in('origen_idea_id', ideas.map(i => i.id))
        .not('guion', 'is', null)
      comprobar(errorPosts, 'los guiones')
      for (const p of posts || []) conGuion.add(p.origen_idea_id)
    }
    return {
      cliente: cliente.nombre,
      ideas: (ideas || []).map(i => ({
        id: i.id,
        titulo: i.titulo,
        concepto: i.concepto,
        formato: i.formato || i.formato_sugerido || null,
        mes: i.mes ? String(i.mes).slice(0, 7) : null,
        tiene_guion: conGuion.has(i.id),
      })),
    }
  }))

  servidor.registerTool('ver_guion', {
    title: 'Ver guion',
    description: 'Guion completo de un post (de ver_calendario): guion, copy, hashtags y notas.',
    inputSchema: { post_id: idSchema('id del post') },
    annotations: { readOnlyHint: true },
  }, herramienta('ver_guion', async ({ post_id }) => {
    const { post, cliente } = await postDeOrganizacion(post_id)
    if (!post.guion && !post.copy) throw new ErrorMcp('Ese post todavía no tiene guion.')
    return {
      cliente: cliente.nombre,
      id: post.id,
      titulo: post.titulo,
      fecha: post.en_calendario === false ? null : post.fecha,
      hora: post.hora ? String(post.hora).slice(0, 5) : null,
      red: post.red,
      formato: post.formato,
      concepto: post.concepto,
      objetivo: post.objetivo,
      guion: post.guion,
      copy: post.copy,
      hashtags: post.hashtags,
      notas: post.notas,
      aprobacion: post.aprobacion_estado || null,
    }
  }))

  servidor.registerTool('ver_metricas', {
    title: 'Ver métricas',
    description: 'Métricas que guarda Aify de un cliente. Instagram: la cuenta conectada y las de cada reel a las 24 h de publicarse (visualizaciones, alcance, me gusta, comentarios, guardados, compartidos, tiempo medio visto y % de saltos). TikTok: la cuenta conectada, la última foto diaria de la cuenta (seguidores, me gustas, vídeos, visualizaciones sumadas) y las de cada vídeo a las 24 h (visualizaciones, me gustas, comentarios, compartidos; TikTok no da alcance ni retención).',
    inputSchema: { cliente_id: idSchema('id del cliente') },
    annotations: { readOnlyHint: true },
  }, herramienta('ver_metricas', async ({ cliente_id }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const [
      { data: conexion, error: errorConexion }, { data: reels, error: errorReels },
      { data: conexionTikTok, error: errorConexionTikTok }, { data: videosTikTok, error: errorVideosTikTok }, { data: fotoTikTok, error: errorFotoTikTok },
    ] = await Promise.all([
      supabaseAdmin.from('instagram_conexiones').select('ig_username, tipo_cuenta, estado, conectado_en').eq('cliente_id', cliente.id).maybeSingle(),
      supabaseAdmin.from('instagram_reels_24h')
        .select('media_id, publicado_en, horas, enlace, texto, visualizaciones, alcance, me_gusta, comentarios, guardados, compartidos, visto_medio_ms, saltos')
        .eq('cliente_id', cliente.id)
        .order('publicado_en', { ascending: false })
        .limit(60),
      supabaseAdmin.from('tiktok_conexiones').select('username, nombre, estado, conectado_en, permisos').eq('cliente_id', cliente.id).maybeSingle(),
      supabaseAdmin.from('tiktok_videos_24h')
        .select('video_id, publicado_en, horas, enlace, texto, visualizaciones, me_gusta, comentarios, compartidos')
        .eq('cliente_id', cliente.id)
        .order('publicado_en', { ascending: false })
        .limit(60),
      supabaseAdmin.from('tiktok_metricas_dia')
        .select('dia, seguidores, me_gustas, videos, visualizaciones_totales, videos_listados')
        .eq('cliente_id', cliente.id)
        .order('dia', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (errorConexion && !esTablaInexistente(errorConexion)) comprobar(errorConexion, 'la conexión de Instagram')
    if (errorReels && !esTablaInexistente(errorReels)) comprobar(errorReels, 'las métricas de los reels')
    if (errorConexionTikTok && !esTablaInexistente(errorConexionTikTok)) comprobar(errorConexionTikTok, 'la conexión de TikTok')
    if (errorVideosTikTok && !esTablaInexistente(errorVideosTikTok)) comprobar(errorVideosTikTok, 'las métricas de los vídeos de TikTok')
    if (errorFotoTikTok && !esTablaInexistente(errorFotoTikTok)) comprobar(errorFotoTikTok, 'las métricas diarias de TikTok')
    const notas = [
      ...(conexion ? [] : ['Este cliente no tiene Instagram conectado en Aify.']),
      ...(conexionTikTok ? [] : ['Este cliente no tiene TikTok conectado en Aify.']),
    ]
    return {
      cliente: cliente.nombre,
      instagram: conexion ? { usuario: conexion.ig_username, tipo_cuenta: conexion.tipo_cuenta, estado: conexion.estado, conectado_en: conexion.conectado_en } : null,
      reels_24h: reels || [],
      tiktok: conexionTikTok
        ? {
          usuario: conexionTikTok.username, nombre: conexionTikTok.nombre, estado: conexionTikTok.estado, conectado_en: conexionTikTok.conectado_en,
          permiso_metricas: ['user.info.stats', 'video.list'].every(p => (conexionTikTok.permisos || []).includes(p)),
          ultima_foto_dia: fotoTikTok || null,
        }
        : null,
      tiktok_videos_24h: videosTikTok || [],
      nota: notas.length ? notas.join(' ') : undefined,
    }
  }))

  // ── Escritura ──────────────────────────────────────────────────────────────

  // Publicación de Instagram de un post (0036); null si no hay o falta la tabla
  async function publicacionDelPost(postId) {
    const { data, error } = await supabaseAdmin.from('instagram_publicaciones').select('*').eq('post_id', postId).maybeSingle()
    if (error && !esTablaInexistente(error)) comprobar(error, 'la publicación de Instagram')
    return data || null
  }

  // Publicación de TikTok de un post (0049); null si no hay o falta la tabla
  async function publicacionTikTokDelPost(postId) {
    const { data, error } = await supabaseAdmin.from('tiktok_publicaciones').select('*').eq('post_id', postId).maybeSingle()
    if (error && !esTablaInexistente(error)) comprobar(error, 'la publicación de TikTok')
    return data || null
  }

  // Archivos ya subidos con pedir_subida (si no, fallaría a la hora de publicar)
  async function archivosSubidos(clienteId, rutas) {
    const prefijo = `${organizacionId}/${clienteId}/`
    const archivos = []
    for (const ruta of rutas) {
      const tipoArchivo = tipoArchivoDeRuta(ruta)
      if (!ruta.startsWith(prefijo) || !tipoArchivo) throw new ErrorMcp(`La ruta ${ruta} no es de este cliente. Usa la ruta que devuelve pedir_subida.`)
      const nombre = ruta.slice(prefijo.length)
      const { data: encontrados, error } = await supabaseAdmin.storage.from(bucketPublicaciones).list(prefijo.slice(0, -1), { search: nombre, limit: 5 })
      const archivo = !error && (encontrados || []).find(a => a.name === nombre)
      if (!archivo) throw new ErrorMcp(`No encuentro el archivo ${ruta}. Súbelo primero con un PUT a la URL de pedir_subida.`)
      archivos.push({ ruta, tipo: tipoArchivo, nombre, ...(archivo.metadata?.size ? { bytes: archivo.metadata.size } : {}) })
    }
    return archivos
  }

  servidor.registerTool('crear_idea', {
    title: 'Crear idea',
    description: 'Guarda una idea nueva para un cliente (sale en su Lluvia de ideas). Opcionalmente, ligada a un mes.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      titulo: z.string().trim().min(1).max(200).describe('Título de la idea'),
      concepto: z.string().trim().min(1).max(4000).describe('De qué va la idea'),
      formato: z.enum(['video', 'carrusel']).describe('video (reel) o carrusel'),
      mes: mesSchema.optional().describe('Mes en formato YYYY-MM (opcional)'),
    },
  }, herramienta('crear_idea', async ({ cliente_id, titulo, concepto, formato, mes }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const fila = { user_id: userId, cliente_id: cliente.id, titulo, concepto, formato, ...(mes ? { mes: `${mes}-01` } : {}) }
    const { data, error } = await supabaseAdmin.from('ideas').insert(fila).select('id, titulo').single()
    if (mes && esColumnaInexistente(error)) throw new ErrorMcp('Para guardar ideas con mes falta aplicar la migración 0045. Créala sin mes.')
    comprobar(error, 'la idea nueva')
    return { ok: true, cliente: cliente.nombre, idea: { id: data.id, titulo: data.titulo, mes: mes || null } }
  }))

  servidor.registerTool('crear_post', {
    title: 'Crear post',
    description: 'Crea un post en el calendario de un cliente, igual que «Nuevo post» en la web: en Instagram (por defecto), en TikTok o en los dos. Opcionalmente con su guion.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      fecha: fechaSchema,
      hora: horaSchema,
      formato: formatoPostSchema.describe('video (reel), carrusel o historia'),
      titulo: z.string().trim().min(1).max(120).describe('Título del post'),
      red: z.enum(Object.keys(REDES_POST)).default('instagram').describe('Dónde se publica: instagram, tiktok o instagram_y_tiktok (por defecto, instagram)'),
      guion: guionSchema.optional().describe('Guion: texto (una frase por línea) u objeto de Aify { gancho, contenido: { frases }, cierre: { remate, cta } }'),
    },
  }, herramienta('crear_post', async ({ cliente_id, fecha, hora, formato, titulo, red, guion }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const destino = REDES_POST[red] || REDES_POST.instagram
    const fila = {
      user_id: userId,
      cliente_id: cliente.id,
      fecha,
      hora,
      red: destino.red,
      comparte_en: destino.comparte_en,
      formato,
      titulo,
      guion: guion ? guionParaDB(guion) : null,
      estado: 'borrador',
    }
    const { data, error } = await supabaseAdmin.from('calendario_posts').insert(fila).select('id, fecha, hora, titulo, formato, red, comparte_en').single()
    comprobar(error, 'el post nuevo')
    return { ok: true, cliente: cliente.nombre, post: { ...data, hora: data.hora ? String(data.hora).slice(0, 5) : null } }
  }))

  servidor.registerTool('mover_post', {
    title: 'Mover post',
    description: 'Cambia la fecha y la hora de un post (también pone fecha a un guion sin programar). Si está programado en Instagram o en TikTok, la publicación se reprograma a la nueva hora, como en la web.',
    inputSchema: { post_id: idSchema('id del post'), fecha: fechaSchema, hora: horaSchema },
  }, herramienta('mover_post', async ({ post_id, fecha, hora }) => {
    const { post, cliente } = await postDeOrganizacion(post_id)
    const [pub, pubTikTok] = await Promise.all([publicacionDelPost(post.id), publicacionTikTokDelPost(post.id)])
    // Lo que se está publicando o ya salió desde Aify no se mueve de día (CalendarioPublicacion.jsx)
    if (pub && ['procesando', 'publicado'].includes(pub.estado)) {
      throw new ErrorMcp(pub.estado === 'publicado' ? 'Este post ya está publicado en Instagram desde Aify: no se mueve.' : 'Este post se está publicando ahora mismo: no se mueve.')
    }
    if (pubTikTok && ['procesando', 'publicado'].includes(pubTikTok.estado)) {
      throw new ErrorMcp(pubTikTok.estado === 'publicado' ? 'Este post ya está publicado en TikTok desde Aify: no se mueve.' : 'Este post se está publicando en TikTok ahora mismo: no se mueve.')
    }
    const cambios = { fecha, hora, ...(post.en_calendario === false ? { en_calendario: true } : {}) }
    const { error } = await supabaseAdmin.from('calendario_posts').update(cambios).eq('id', post.id)
    comprobar(error, 'el post')

    let instagram = null
    if (pub?.estado === 'programado') {
      const resultado = await programarPublicacion({
        clienteId: cliente.id,
        organizacionId,
        postId: post.id,
        body: {
          tipo: pub.tipo, archivos: pub.archivos, portadaRuta: pub.portada_ruta, portadaNombre: pub.contenedores?.portada_nombre || null,
          caption: pub.caption || '', compartirEnFeed: pub.compartir_en_feed, publicarEn: isoDesdeHoraEspaña(fecha, hora),
        },
        userId,
      })
      instagram = resultado.error
        ? { aviso: `El post se ha movido, pero la publicación de Instagram sigue a su hora: ${resultado.error}` }
        : { reprogramado: true, publicar_en: resultado.publicacion.publicar_en }
    }

    // TikTok: solo cambia la hora, sin tocar lo que eligió el usuario (como el PATCH de la web)
    let tiktok = null
    if (pubTikTok?.estado === 'programado') {
      const resultado = await moverPublicacionTikTok({ clienteId: cliente.id, postId: post.id, publicarEn: isoDesdeHoraEspaña(fecha, hora) })
      tiktok = resultado.error
        ? { aviso: `El post se ha movido, pero la publicación de TikTok sigue a su hora: ${resultado.error}` }
        : { reprogramado: true, publicar_en: resultado.publicacion.publicar_en }
    }
    return { ok: true, cliente: cliente.nombre, post: { id: post.id, fecha, hora }, instagram, tiktok }
  }))

  servidor.registerTool('pedir_subida', {
    title: 'Pedir URL de subida',
    description: 'Da una URL firmada para subir un archivo (vídeo MP4 o imagen JPEG) al almacenamiento de Aify. Sube el archivo con un PUT a esa URL (cabecera Content-Type con el tipo) y luego usa la "ruta" en programar_publicacion o programar_tiktok. La URL caduca a las 2 horas.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      nombre_archivo: z.string().trim().min(1).max(255).describe('Nombre del archivo original, por ejemplo reel-noviembre.mp4'),
      tipo: z.enum(Object.keys(TIPOS_SUBIDA)).describe('video/mp4 o image/jpeg'),
    },
  }, herramienta('pedir_subida', async ({ cliente_id, nombre_archivo, tipo }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id')
    // Misma ruta que el navegador: <organización>/<cliente>/<uuid>.<ext>
    const ruta = `${organizacionId}/${cliente.id}/${crypto.randomUUID()}.${TIPOS_SUBIDA[tipo].ext}`
    const { data, error } = await supabaseAdmin.storage.from(bucketPublicaciones).createSignedUploadUrl(ruta)
    if (error || !data?.signedUrl) {
      console.error('[mcp] pedir_subida:', error?.message)
      throw new ErrorMcp('No se pudo preparar la subida. Inténtalo de nuevo.')
    }
    return {
      url_subida: data.signedUrl,
      metodo: 'PUT',
      cabeceras: { 'Content-Type': tipo },
      ruta,
      nombre_archivo,
      ejemplo: `curl -X PUT -H "Content-Type: ${tipo}" --data-binary @"${nombre_archivo}" "${data.signedUrl}"`,
    }
  }))

  servidor.registerTool('programar_publicacion', {
    title: 'Programar publicación en Instagram',
    description: 'Programa (o reprograma) en Instagram un post del calendario con archivos ya subidos con pedir_subida. Hace lo mismo que «Programar» en la web. Un reel lleva 1 vídeo, un post 1 imagen, un carrusel de 2 a 10 archivos y una historia 1 archivo.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      post_id: idSchema('id del post del calendario'),
      tipo: z.enum(['reel', 'post', 'carrusel', 'historia']),
      rutas: z.array(z.string().min(1)).min(1).max(10).describe('Rutas devueltas por pedir_subida, en orden'),
      caption: z.string().max(2200).default('').describe('Texto de la publicación (las historias no llevan)'),
      publicar_en: z.iso.datetime({ offset: true }).describe('Fecha y hora de publicación en ISO 8601 con zona, por ejemplo 2026-11-05T18:30:00+01:00'),
      compartir_en_feed: z.boolean().optional().describe('Reels: si también sale en el feed (por defecto, sí)'),
    },
  }, herramienta('programar_publicacion', async ({ cliente_id, post_id, tipo, rutas, caption, publicar_en, compartir_en_feed }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    // Cada archivo tiene que estar ya subido (si no, fallaría a la hora de publicar)
    const archivos = await archivosSubidos(cliente.id, rutas)

    const resultado = await programarPublicacion({
      clienteId: cliente.id,
      organizacionId,
      postId: post_id,
      body: { tipo, archivos, caption, publicarEn: publicar_en, compartirEnFeed: compartir_en_feed !== false },
      userId,
    })
    if (resultado.error) throw new ErrorMcp(resultado.estado === 404 ? 'No hay ningún post con ese id en ese cliente.' : resultado.error)
    const pub = resultado.publicacion
    return { ok: true, cliente: cliente.nombre, publicacion: { post_id: pub.post_id, tipo: pub.tipo, estado: pub.estado, publicar_en: pub.publicar_en, archivos: pub.archivos.length } }
  }))

  // ── TikTok ──

  // Configuración y conexión con permiso para publicar, como la web
  async function comprobarTikTok(clienteId) {
    if (!tiktokConfigurado()) throw new ErrorMcp('La conexión con TikTok todavía no está configurada en Aify.')
    const conexion = await conexionTikTok(clienteId)
    if (!conexion || conexion.estado !== 'activa') throw new ErrorMcp('Este cliente no tiene TikTok conectado (o hay que volver a conectarlo). Se conecta en Aify, en el Seguimiento del cliente.')
    if (!(conexion.permisos || []).includes(permisoPublicarTikTok)) throw new ErrorMcp('La cuenta de TikTok no dio permiso para publicar. Vuelve a conectarla en Aify aceptando todos los permisos.')
    return conexion
  }

  async function creadorDe(clienteId) {
    const resultado = await creadorTikTok(clienteId)
    if (resultado.error) throw new ErrorMcp(resultado.error)
    return resultado.creador
  }

  servidor.registerTool('ver_creador_tiktok', {
    title: 'Ver cuenta de TikTok para publicar',
    description: 'Lo que TikTok deja hacer ahora a la cuenta del cliente (creator_info): nombre y usuario de la cuenta que publica, opciones de privacidad, interacciones desactivadas y duración máxima del vídeo. Pídelo antes de programar_tiktok y enseña al usuario la cuenta y las opciones de privacidad para que elija él.',
    inputSchema: { cliente_id: idSchema('id del cliente') },
    annotations: { readOnlyHint: true },
  }, herramienta('ver_creador_tiktok', async ({ cliente_id }) => {
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    await comprobarTikTok(cliente.id)
    const creador = await creadorDe(cliente.id)
    return {
      cliente: cliente.nombre,
      cuenta: { nombre: creador.nombre, usuario: creador.usuario },
      privacidades: creador.opcionesPrivacidad.map(p => ({ valor: p, nombre: PRIVACIDADES_TIKTOK[p] || p })),
      comentarios_desactivados: creador.comentariosDesactivados,
      duo_desactivado: creador.duoDesactivado,
      stitch_desactivado: creador.stitchDesactivado,
      duracion_max_seg: creador.duracionMaxSeg,
      solo_privado: creador.soloPrivado,
      nota: creador.soloPrivado ? 'Hasta que TikTok apruebe la auditoría de Aify, solo se puede publicar como «Solo yo» (SELF_ONLY) y en cuentas privadas.' : undefined,
    }
  }))

  servidor.registerTool('programar_tiktok', {
    title: 'Programar publicación en TikTok',
    description: 'Programa (o reprograma) en TikTok un post del calendario que sale en TikTok, con archivos ya subidos con pedir_subida. Hace lo mismo que «Programar en TikTok» en la web. Un vídeo lleva 1 MP4 (como mucho duracion_max_seg de ver_creador_tiktok: Aify no lo comprueba desde aquí); fotos, de 1 a 35 JPEG. '
      + 'Reglas de TikTok: antes, enseña al usuario la cuenta que publica (ver_creador_tiktok) y deja que ELIJA ÉL la privacidad (no hay valor por defecto, no la elijas tú) y si permite comentarios, dúo y stitch (desmarcados salvo que lo pida). '
      + 'Si el contenido promociona algo, contenido_comercial con marca_propia («Contenido promocional») y/o contenido_de_marca («Colaboración pagada»; no puede ser «Solo yo»). '
      + 'consentimiento: true solo si el usuario ha aceptado la Music Usage Confirmation de TikTok (https://www.tiktok.com/legal/page/global/music-usage-confirmation/en) y, con contenido de marca, la Branded Content Policy (https://www.tiktok.com/legal/page/global/bc-policy/en); Aify guarda la fecha. '
      + 'Hasta que TikTok apruebe la auditoría de Aify, solo se puede publicar como «Solo yo» (SELF_ONLY). Al publicar, TikTok puede tardar unos minutos en enseñarlo.',
    inputSchema: {
      cliente_id: idSchema('id del cliente'),
      post_id: idSchema('id del post del calendario (con red tiktok o instagram_y_tiktok)'),
      tipo: z.enum(['video', 'fotos']),
      rutas: z.array(z.string().min(1)).min(1).max(35).describe('Rutas devueltas por pedir_subida, en orden (vídeo: 1 MP4; fotos: de 1 a 35 JPEG)'),
      titulo: z.string().max(2200).default('').describe('Vídeo: el texto de la publicación (hasta 2.200). Fotos: el título (hasta 90)'),
      descripcion: z.string().max(4000).optional().describe('Solo fotos: la descripción (hasta 4.000)'),
      privacidad: z.enum(Object.keys(PRIVACIDADES_TIKTOK)).describe('Quién puede verlo, ELEGIDO POR EL USUARIO entre las privacidades de ver_creador_tiktok'),
      permitir_comentarios: z.boolean().default(false),
      permitir_duo: z.boolean().default(false).describe('Solo vídeo'),
      permitir_stitch: z.boolean().default(false).describe('Solo vídeo'),
      contenido_comercial: z.boolean().default(false).describe('El contenido promociona una marca, producto o servicio'),
      marca_propia: z.boolean().default(false).describe('Con contenido_comercial: promociona la marca del propio cliente («Contenido promocional»)'),
      contenido_de_marca: z.boolean().default(false).describe('Con contenido_comercial: promociona a un tercero («Colaboración pagada»)'),
      es_ia: z.boolean().default(false).describe('Solo vídeo: generado con IA (is_aigc)'),
      musica_auto: z.boolean().default(false).describe('Solo fotos: que TikTok añada música'),
      consentimiento: z.literal(true).describe('true solo si el usuario ha aceptado las condiciones de TikTok (ver descripción)'),
      publicar_en: z.iso.datetime({ offset: true }).describe('Fecha y hora de publicación en ISO 8601 con zona, por ejemplo 2026-11-05T18:30:00+01:00'),
    },
  }, herramienta('programar_tiktok', async (args) => {
    const { cliente_id, post_id, tipo, rutas, titulo, descripcion, privacidad, publicar_en } = args
    const cliente = await clienteDeOrganizacion(cliente_id, 'id, nombre')
    const { post } = await postDeOrganizacion(post_id)
    if (post.cliente_id !== cliente.id) throw new ErrorMcp('No hay ningún post con ese id en ese cliente.')
    if (!esDeRed(post, 'tiktok')) throw new ErrorMcp('Ese post no sale en TikTok. Crea uno con red tiktok o instagram_y_tiktok (crear_post).')
    await comprobarTikTok(cliente.id)

    // Las opciones salen de creator_info, pedido ahora (TikTok lo exige)
    const creador = await creadorDe(cliente.id)
    if (!creador.opcionesPrivacidad.includes(privacidad)) {
      const opciones = creador.opcionesPrivacidad.map(p => `${p} (${PRIVACIDADES_TIKTOK[p] || p})`).join(', ')
      throw new ErrorMcp(`Esta cuenta no admite la privacidad ${privacidad}. Opciones: ${opciones || 'ninguna'}. Pregunta al usuario cuál quiere.`)
    }
    if (!tiktokAuditada && privacidad !== 'SELF_ONLY') {
      throw new ErrorMcp('Hasta que TikTok apruebe la auditoría de Aify, solo se puede publicar como «Solo yo» (SELF_ONLY).')
    }
    const video = tipo === 'video'
    if (args.permitir_comentarios && creador.comentariosDesactivados) throw new ErrorMcp('Esta cuenta tiene los comentarios desactivados en TikTok: no se pueden permitir desde Aify.')
    if (!video && (args.permitir_duo || args.permitir_stitch)) throw new ErrorMcp('En las publicaciones de fotos solo se pueden permitir comentarios (no dúo ni stitch).')
    if (args.permitir_duo && creador.duoDesactivado) throw new ErrorMcp('Esta cuenta tiene el dúo desactivado en TikTok: no se puede permitir desde Aify.')
    if (args.permitir_stitch && creador.stitchDesactivado) throw new ErrorMcp('Esta cuenta tiene el stitch desactivado en TikTok: no se puede permitir desde Aify.')

    const archivos = await archivosSubidos(cliente.id, rutas)
    const resultado = await programarPublicacionTikTok({
      clienteId: cliente.id,
      organizacionId,
      postId: post.id,
      body: {
        tipo,
        archivos,
        titulo,
        descripcion: video ? undefined : descripcion || '',
        privacidad,
        permitirComentarios: args.permitir_comentarios,
        permitirDuo: args.permitir_duo,
        permitirStitch: args.permitir_stitch,
        contenidoComercial: args.contenido_comercial,
        marcaPropia: args.marca_propia,
        contenidoDeMarca: args.contenido_de_marca,
        esIa: args.es_ia,
        musicaAuto: args.musica_auto,
        consentimiento: args.consentimiento === true,
        publicarEn: publicar_en,
      },
      userId,
    })
    if (resultado.error) throw new ErrorMcp(resultado.estado === 404 ? 'No hay ningún post con ese id en ese cliente.' : resultado.error)
    const pub = resultado.publicacion
    return {
      ok: true,
      cliente: cliente.nombre,
      cuenta: creador.usuario ? `@${creador.usuario}` : creador.nombre,
      publicacion: { post_id: pub.post_id, tipo: pub.tipo, estado: pub.estado, privacidad: pub.privacidad, publicar_en: pub.publicar_en, archivos: pub.archivos.length, consentimiento_en: pub.consentimiento_en },
      nota: 'A su hora, Aify la manda a TikTok; puede tardar unos minutos en aparecer.',
    }
  }))

  servidor.registerTool('marcar_publicado', {
    title: 'Marcar como publicado',
    description: 'Marca un post como publicado cuando se ha subido a Instagram o a TikTok a mano (fuera de Aify), para que cuente en el recuento.',
    inputSchema: { post_id: idSchema('id del post') },
  }, herramienta('marcar_publicado', async ({ post_id }) => {
    const { post, cliente } = await postDeOrganizacion(post_id)
    // Lo programado o publicado desde Aify (en Instagram o en TikTok) lleva su propio estado (CalendarioPublicacion.jsx)
    const [pub, pubTikTok] = await Promise.all([publicacionDelPost(post.id), publicacionTikTokDelPost(post.id)])
    for (const [p, red] of [[pub, 'Instagram'], [pubTikTok, 'TikTok']]) {
      if (p && p.estado !== 'cancelado' && p.estado !== 'error') {
        throw new ErrorMcp(p.estado === 'publicado' ? `Este post ya está publicado en ${red} desde Aify.` : `Este post está programado en ${red} desde Aify: se marcará solo al publicarse.`)
      }
    }
    const { error } = await supabaseAdmin.from('calendario_posts').update({ estado: 'publicado' }).eq('id', post.id)
    comprobar(error, 'el post')
    return { ok: true, cliente: cliente.nombre, post: { id: post.id, titulo: post.titulo, estado: 'publicado' } }
  }))

  return servidor
}

const errorJsonRpc = (res, estado, mensaje) => res.status(estado).json({ jsonrpc: '2.0', error: { code: -32000, message: mensaje }, id: null })

export function montarMcp(app, { requireClaveApi, ...dependencias }) {
  app.post('/mcp', requireClaveApi, async (req, res) => {
    const servidor = crearServidorMcp(dependencias, { organizacionId: req.organizacionId, userId: req.userId })
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      transporte.close()
      servidor.close()
    })
    try {
      await servidor.connect(transporte)
      await transporte.handleRequest(req, res, req.body)
    } catch (err) {
      console.error('[mcp] error atendiendo la petición:', err.message)
      if (!res.headersSent) errorJsonRpc(res, 500, 'Error interno del MCP de Aify')
    }
  })

  // Sin estado: no hay stream de notificaciones (GET) ni sesión que cerrar (DELETE)
  const noPermitido = (_req, res) => errorJsonRpc(res, 405, 'Método no permitido: el MCP de Aify solo acepta POST.')
  app.get('/mcp', requireClaveApi, noPermitido)
  app.delete('/mcp', requireClaveApi, noPermitido)
}
