import crypto from 'node:crypto'

// ── Pizarras (0054_pizarras.sql, docs/mcp.md) ─────────────────────────────────
// «Mira mi pizarra» de Aify Pictures: Studio sube la pizarra de un proyecto y
// la IA del usuario la lee y deja resultados en ella. Lo usan las herramientas
// del MCP (mcp/servidor.js) y las rutas /api/pizarras de server.js, con la
// misma lógica y el mismo formato de respuesta.
//
// Todo pasa por organizacionId (la de la clave de API o el token de OAuth):
// supabaseAdmin se salta RLS, así que cada consulta filtra por ella.
//
// contenido es el JSON de Studio: { nodos, flechas, apuntes }
//   nodo:   { id, tipo, x, y, ancho, alto, datos }   (tipo: nota, imagen,
//           video, voz, enlace, kit). Los archivos subidos a Aify llevan su
//           ruta del bucket en datos.ruta (o en ruta).
//   flecha: { id, desde, hasta, texto? }
//   apunte: { id, titulo, texto, actualizado }

export const MAX_BYTES_PIZARRA = 1024 * 1024
export const MAX_NODOS_POR_LLAMADA = 20
const MAX_PIZARRAS_LISTADO = 50
const SEGUNDOS_URL_LECTURA = 60 * 60
const REINTENTOS_ANADIR = 3

// Lo que se puede subir a una pizarra (pedir_subida con destino 'pizarra')
export const TIPOS_SUBIDA_PIZARRA = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
}

// Tamaño por defecto de los nodos que añade Claude (los de Studio: nota 240×56)
const TAMANO_NODO = {
  nota: { ancho: 240, alto: 56 },
  imagen: { ancho: 320, alto: 320 },
  video: { ancho: 320, alto: 400 },
  voz: { ancho: 240, alto: 64 },
}
const SEPARACION = 40

// Error con mensaje para quien llama (Claude o Studio) y su código HTTP
export class ErrorPizarra extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje)
    this.estado = estado
  }
}

const SIN_MIGRACION = 'Las pizarras aún no están activadas en Aify (falta aplicar la migración 0054).'
const esTablaInexistente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')

function comprobar(error, que) {
  if (!error) return
  if (esTablaInexistente(error)) throw new ErrorPizarra(SIN_MIGRACION, 503)
  console.error(`[pizarras] error con ${que}:`, error.message)
  throw new ErrorPizarra(`No se pudo leer o guardar ${que} en Aify. Inténtalo de nuevo.`, 500)
}

// Comprueba la forma básica del contenido de Studio sin imponer el resto:
// lo que no conoce Aify se guarda tal cual.
export function validarContenido(contenido) {
  if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
    throw new ErrorPizarra('El contenido de la pizarra tiene que ser un objeto { nodos, flechas }.')
  }
  const nodos = contenido.nodos ?? []
  const flechas = contenido.flechas ?? []
  if (!Array.isArray(nodos) || !Array.isArray(flechas)) {
    throw new ErrorPizarra('nodos y flechas tienen que ser listas.')
  }
  for (const nodo of nodos) {
    if (!nodo || typeof nodo !== 'object' || typeof nodo.id !== 'string' || !nodo.id || typeof nodo.tipo !== 'string') {
      throw new ErrorPizarra('Cada nodo necesita un id y un tipo (texto).')
    }
  }
  const limpio = { ...contenido, nodos, flechas }
  if (new TextEncoder().encode(JSON.stringify(limpio)).length > MAX_BYTES_PIZARRA) {
    throw new ErrorPizarra('La pizarra ocupa más de 1 MB. Sube las imágenes y los vídeos como archivos (pedir_subida) en vez de meterlos en el contenido.', 413)
  }
  return limpio
}

const rutaDeNodo = (nodo) => (typeof nodo?.ruta === 'string' ? nodo.ruta : typeof nodo?.datos?.ruta === 'string' ? nodo.datos.ruta : null)
const idNodo = () => `cla_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`

const resumen = (fila) => ({ pizarra_id: fila.id, titulo: fila.titulo, cliente_id: fila.cliente_id, actualizada_en: fila.actualizada_en, creada_en: fila.creada_en })

export function crearPizarras({ supabaseAdmin, bucket, organizacionId }) {
  async function clienteDeOrganizacion(clienteId) {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('id, nombre')
      .eq('id', clienteId)
      .eq('organizacion_id', organizacionId)
      .maybeSingle()
    comprobar(error, 'el cliente')
    if (!data) throw new ErrorPizarra('No hay ningún cliente con ese id en tu organización. Usa listar_clientes para ver los ids.', 404)
    return data
  }

  async function pizarraDeOrganizacion(pizarraId, columnas = '*') {
    const { data, error } = await supabaseAdmin
      .from('pizarras')
      .select(columnas)
      .eq('id', pizarraId)
      .eq('organizacion_id', organizacionId)
      .maybeSingle()
    comprobar(error, 'la pizarra')
    if (!data) throw new ErrorPizarra('No hay ninguna pizarra con ese id en tu organización. Usa listar_pizarras para ver los ids.', 404)
    return data
  }

  const prefijoArchivos = (clienteId) => `${organizacionId}/${clienteId}/pizarras/`

  // Crea (sin pizarra_id) o sustituye una pizarra. Con actualizada_en, solo
  // guarda si nadie la ha cambiado desde entonces (si no, 409 con la actual).
  async function guardar({ cliente_id, pizarra_id, titulo, contenido, actualizada_en }) {
    const tituloLimpio = typeof titulo === 'string' ? titulo.trim().slice(0, 200) : ''
    if (!tituloLimpio) throw new ErrorPizarra('Ponle un título a la pizarra.')
    const limpio = validarContenido(contenido)
    const ahora = new Date().toISOString()

    if (!pizarra_id) {
      if (!cliente_id) throw new ErrorPizarra('Falta cliente_id para crear la pizarra.')
      const cliente = await clienteDeOrganizacion(cliente_id)
      const { data, error } = await supabaseAdmin
        .from('pizarras')
        .insert({ organizacion_id: organizacionId, cliente_id: cliente.id, titulo: tituloLimpio, contenido: limpio, creada_en: ahora, actualizada_en: ahora })
        .select('id, actualizada_en')
        .single()
      comprobar(error, 'la pizarra nueva')
      return { pizarra_id: data.id, actualizada_en: data.actualizada_en, creada: true }
    }

    const actual = await pizarraDeOrganizacion(pizarra_id, 'id, cliente_id, actualizada_en')
    if (cliente_id && cliente_id !== actual.cliente_id) throw new ErrorPizarra('Esa pizarra es de otro cliente.')
    let consulta = supabaseAdmin
      .from('pizarras')
      .update({ titulo: tituloLimpio, contenido: limpio, actualizada_en: ahora })
      .eq('id', actual.id)
      .eq('organizacion_id', organizacionId)
    if (actualizada_en) consulta = consulta.eq('actualizada_en', actualizada_en)
    const { data, error } = await consulta.select('id, actualizada_en')
    comprobar(error, 'la pizarra')
    if (!data?.length) {
      throw new ErrorPizarra('La pizarra ha cambiado desde que la leíste (quizá la IA ha añadido algo). Vuelve a leerla antes de guardar.', 409)
    }
    return { pizarra_id: data[0].id, actualizada_en: data[0].actualizada_en, creada: false }
  }

  async function listar({ cliente_id }) {
    const cliente = await clienteDeOrganizacion(cliente_id)
    const { data, error } = await supabaseAdmin
      .from('pizarras')
      .select('id, titulo, cliente_id, creada_en, actualizada_en')
      .eq('cliente_id', cliente.id)
      .eq('organizacion_id', organizacionId)
      .order('actualizada_en', { ascending: false })
      .limit(MAX_PIZARRAS_LISTADO)
    comprobar(error, 'las pizarras')
    return { cliente: { id: cliente.id, nombre: cliente.nombre }, pizarras: (data || []).map(resumen) }
  }

  // La pizarra con una URL de lectura (1 h) en cada nodo con archivo. Solo se
  // firman rutas de la carpeta de pizarras de su cliente: el contenido lo
  // escribe la organización, y una ruta ajena no debe abrir nada.
  async function ver({ pizarra_id }) {
    const fila = await pizarraDeOrganizacion(pizarra_id)
    const { data: cliente } = await supabaseAdmin.from('clientes').select('id, nombre').eq('id', fila.cliente_id).maybeSingle()
    const contenido = fila.contenido && typeof fila.contenido === 'object' ? fila.contenido : {}
    const nodos = Array.isArray(contenido.nodos) ? contenido.nodos : []
    const prefijo = prefijoArchivos(fila.cliente_id)
    const rutas = [...new Set(nodos.map(rutaDeNodo).filter(r => r && r.startsWith(prefijo) && !r.includes('..')))]

    const urls = new Map()
    if (rutas.length) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(rutas, SEGUNDOS_URL_LECTURA)
      if (error) console.error('[pizarras] no se pudieron firmar las URLs:', error.message)
      for (const firmada of data || []) if (firmada?.path && firmada.signedUrl && !firmada.error) urls.set(firmada.path, firmada.signedUrl)
    }

    return {
      ...resumen(fila),
      cliente: cliente ? { id: cliente.id, nombre: cliente.nombre } : { id: fila.cliente_id },
      contenido: {
        ...contenido,
        nodos: nodos.map((nodo) => {
          const ruta = rutaDeNodo(nodo)
          return ruta ? { ...nodo, url: urls.get(ruta) || null } : nodo
        }),
        flechas: Array.isArray(contenido.flechas) ? contenido.flechas : [],
      },
      urls_caducan_en: rutas.length ? new Date(Date.now() + SEGUNDOS_URL_LECTURA * 1000).toISOString() : null,
    }
  }

  // Añade nodos sin pisar lo que hay: lee, añade y guarda solo si nadie la ha
  // cambiado entretanto (actualizada_en); si la han cambiado, vuelve a leer.
  async function anadir({ pizarra_id, nodos }) {
    if (!Array.isArray(nodos) || !nodos.length) throw new ErrorPizarra('Añade al menos un nodo.')
    if (nodos.length > MAX_NODOS_POR_LLAMADA) throw new ErrorPizarra(`Como mucho ${MAX_NODOS_POR_LLAMADA} nodos por llamada.`)

    for (let intento = 0; intento < REINTENTOS_ANADIR; intento++) {
      const fila = await pizarraDeOrganizacion(pizarra_id, 'id, cliente_id, contenido, actualizada_en')
      const prefijo = prefijoArchivos(fila.cliente_id)
      const contenido = fila.contenido && typeof fila.contenido === 'object' ? fila.contenido : {}
      const existentes = Array.isArray(contenido.nodos) ? contenido.nodos : []
      const porId = new Map(existentes.map(n => [n.id, n]))
      const finalDerecho = existentes.reduce((max, n) => Math.max(max, (Number(n.x) || 0) + (Number(n.ancho) || 0)), 0)
      const arriba = existentes.length ? Math.min(...existentes.map(n => Number(n.y) || 0)) : 0
      // Siguiente hueco libre de cada columna (al lado de un nodo o a la derecha de todo)
      const huecos = new Map()
      const ahora = new Date().toISOString()

      const nuevos = nodos.map((entrada, i) => {
        const tipo = entrada.tipo === 'audio' ? 'voz' : entrada.tipo
        if (!TAMANO_NODO[tipo]) throw new ErrorPizarra(`Tipo de nodo no válido en el nodo ${i + 1}: usa nota, imagen, video o audio.`)
        const texto = typeof entrada.texto === 'string' ? entrada.texto : ''
        const ruta = typeof entrada.ruta === 'string' ? entrada.ruta.trim() : ''
        if (tipo === 'nota' && !texto.trim()) throw new ErrorPizarra(`El nodo ${i + 1} es una nota sin texto.`)
        if (tipo !== 'nota' && !ruta) throw new ErrorPizarra(`El nodo ${i + 1} (${entrada.tipo}) necesita la ruta del archivo que devuelve pedir_subida con destino «pizarra».`)
        if (ruta && (!ruta.startsWith(prefijo) || ruta.includes('..'))) {
          throw new ErrorPizarra(`La ruta ${ruta} no es de las pizarras de este cliente. Usa la ruta que devuelve pedir_subida con destino «pizarra» y el cliente de la pizarra.`)
        }

        const tamano = TAMANO_NODO[tipo]
        const cerca = entrada.cerca_de ? porId.get(entrada.cerca_de) : null
        if (entrada.cerca_de && !cerca) throw new ErrorPizarra(`No hay ningún nodo con id ${entrada.cerca_de} en la pizarra.`)
        const columna = cerca ? `junto:${cerca.id}` : 'derecha'
        const x = cerca ? (Number(cerca.x) || 0) + (Number(cerca.ancho) || 0) + SEPARACION : (existentes.length ? finalDerecho + SEPARACION * 2 : 0)
        const y = huecos.has(columna) ? huecos.get(columna) : (cerca ? Number(cerca.y) || 0 : arriba)
        huecos.set(columna, y + tamano.alto + SEPARACION / 2)

        const datos = tipo === 'nota'
          ? { texto, caja: true, tinta: 'negra' }
          : { ruta, ...(texto ? { texto } : {}) }
        return { id: idNodo(), tipo, x: Math.round(x), y: Math.round(y), ancho: tamano.ancho, alto: tamano.alto, datos, autor: 'claude', creado_en: ahora }
      })

      const actualizado = validarContenido({ ...contenido, nodos: [...existentes, ...nuevos] })
      const { data, error } = await supabaseAdmin
        .from('pizarras')
        .update({ contenido: actualizado, actualizada_en: ahora })
        .eq('id', fila.id)
        .eq('organizacion_id', organizacionId)
        .eq('actualizada_en', fila.actualizada_en)
        .select('id, actualizada_en')
      comprobar(error, 'la pizarra')
      if (data?.length) {
        return { pizarra_id: fila.id, actualizada_en: data[0].actualizada_en, nodos_creados: nuevos.map(n => ({ id: n.id, tipo: n.tipo, x: n.x, y: n.y })) }
      }
    }
    throw new ErrorPizarra('La pizarra está cambiando ahora mismo. Inténtalo de nuevo en unos segundos.', 409)
  }

  // URL firmada para subir un archivo a la carpeta de pizarras del cliente
  async function pedirSubida({ cliente_id, nombre_archivo, tipo }) {
    const ext = TIPOS_SUBIDA_PIZARRA[tipo]
    if (!ext) throw new ErrorPizarra(`Tipo no admitido en una pizarra: ${tipo}. Usa uno de ${Object.keys(TIPOS_SUBIDA_PIZARRA).join(', ')}.`)
    const cliente = await clienteDeOrganizacion(cliente_id)
    const ruta = `${prefijoArchivos(cliente.id)}${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(ruta)
    if (error || !data?.signedUrl) {
      console.error('[pizarras] pedir subida:', error?.message)
      throw new ErrorPizarra('No se pudo preparar la subida. Inténtalo de nuevo.', 500)
    }
    return {
      url_subida: data.signedUrl,
      metodo: 'PUT',
      cabeceras: { 'Content-Type': tipo },
      ruta,
      nombre_archivo,
      destino: 'pizarra',
      ejemplo: `curl -X PUT -H "Content-Type: ${tipo}" --data-binary @"${nombre_archivo}" "${data.signedUrl}"`,
    }
  }

  return { guardar, listar, ver, anadir, pedirSubida }
}
