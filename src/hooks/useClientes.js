import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { clientes as mockClientes } from '../data/mockData'

const LS_KEY = 'aify_clientes'

// ── localStorage helpers (only used when Supabase not configured) ──────────────

function lsRead() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s !== null ? JSON.parse(s) : null
  } catch { return null }
}

function lsSave(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('aify:clientes'))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
  }
}

// Returns localStorage clientes; seeds with mock data on first use
function lsClientes() {
  const saved = lsRead()
  if (saved !== null) return saved
  lsSave(mockClientes) // seed demo data on first load
  return mockClientes
}

// ── Color/sector helpers ──────────────────────────────────────────────────────

const SECTOR_COLORS = {
  restauracion: '#FF9500', 'Restauración': '#FF9500',
  moda: '#3D9BFF', 'Moda': '#3D9BFF',
  fitness: '#30D158', 'Fitness': '#30D158',
  belleza: '#FF2D55', 'Belleza': '#FF2D55',
  retail: '#1D5FE0', 'Retail': '#1D5FE0',
  servicios: '#64D2FF', 'Servicios': '#64D2FF',
  educacion: '#FF9500', 'Educación': '#FF9500',
  tecnologia: '#3D9BFF', 'Tecnología': '#3D9BFF',
  otro: '#86868B', 'Otro': '#86868B',
}

function formatRelative(dateStr) {
  if (!dateStr) return '–'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// ── Supabase mappers ──────────────────────────────────────────────────────────

export function mapearCliente(row) {
  const redesObj = row.redes || {}
  const redesArray = typeof redesObj === 'object' && !Array.isArray(redesObj)
    ? Object.keys(redesObj).filter(k => redesObj[k]?.activa)
    : (Array.isArray(redesObj) ? redesObj : [])
  return {
    id: row.id,
    nombre: row.nombre,
    fotoUrl: row.foto_url || null,
    sector: row.sector || '',
    sectorCustom: row.sector_custom || '',
    web: row.web || '',
    descripcion: row.descripcion || '',
    diferencial: row.diferencial || '',
    ubicacion: row.ubicacion || '',
    ticketMedio: row.ticket_medio || '',
    audiencia: row.audiencia || {},
    tono: row.tono || '',
    tonoId: row.tono || '',
    tonoDescripcion: row.tono_descripcion || '',
    vozPropia: row.tono_descripcion || '',
    energia: row.energia || '',
    vozGenero: row.voz_genero || '',
    usoEmojis: row.uso_emojis || '',
    estiloTexto: row.estilo_texto || [],
    prohibido: row.prohibido || '',
    redes: redesArray,
    redesDetalladas: Array.isArray(redesObj) ? {} : redesObj,
    historial: row.historial || {},
    fechasClave: row.fechas_clave || {},
    fechasClaveObj: row.fechas_clave || {},
    identidadVisual: row.identidad_visual || {},
    textoVideos: row.texto_videos || {},
    videosCliente: row.videos_cliente || [],
    videosReferencia: row.videos_referencia || [],
    perfilComunicacion: row.perfil_comunicacion || null,
    color: SECTOR_COLORS[row.sector] || '#1D5FE0',
    ultimaActividad: formatRelative(row.updated_at || row.created_at),
    postsEsteMes: 0,
    creadoEn: row.created_at,
    updatedAt: row.updated_at,
    organizacionId: row.organizacion_id || null,
    archivado: row.archivado || false,
    feedToken: row.feed_token || null,
    // tablero de clientes (0024_tableros.sql); null = primera columna
    etapaId: row.etapa_id ?? row.etapaId ?? null,
    etapaOrden: row.etapa_orden ?? row.etapaOrden ?? null,
    cuotaMensual: (row.cuota_mensual ?? row.cuotaMensual) != null ? Number(row.cuota_mensual ?? row.cuotaMensual) : null,
    // Onboarding v2 (migración 0023)
    nombreContacto: row.nombre_contacto || '',
    email: row.email || '',
    telefono: row.telefono || '',
    googleMaps: row.google_maps || '',
    redesEnlaces: row.redes_enlaces || {},
    porQueElegirnos: row.por_que_elegirnos || '',
    rangoPrecio: row.rango_precio || '',
    temas: Array.isArray(row.temas) ? row.temas : [],
    barrerasInternas: row.barreras_internas || '',
    barrerasExternas: row.barreras_externas || '',
    publicoObjetivo: row.publico_objetivo || '',
    queBuscan: row.que_buscan || '',
    competidores: Array.isArray(row.competidores) ? row.competidores : [],
    cuentasReferencia: Array.isArray(row.referencias) ? row.referencias : [],
    // "frecuencia" en la BD = ritmo de publicación elegido en el onboarding.
    // En el objeto cliente va como ritmoPublicacion porque `frecuencia` ya
    // existe en datos locales antiguos como mapa por red ({ instagram: 3 }).
    ritmoPublicacion: row.frecuencia || '',
    // 0026: null = como la organización; undefined = columna aún no existe
    modoCobro: row.modo_cobro !== undefined ? row.modo_cobro : row.modoCobro,
    // 0031: frases reales de sus clientes (utils/vozCliente.js)
    vozCliente: Array.isArray(row.voz_cliente) ? row.voz_cliente : (Array.isArray(row.vozCliente) ? row.vozCliente : []),
    // 0041: null = negocio; objeto = marca personal (utils/marcaPersonal.js)
    marcaPersonal: row.marca_personal ?? row.marcaPersonal ?? null,
  }
}

// Columnas nuevas del onboarding v2 (0023_onboarding_v2.sql): clave del objeto
// cliente -> columna. Mientras la migración no esté aplicada en producción,
// PostgREST rechaza cualquier columna desconocida en insert/update, así que
// clienteDataParaDB solo las envía cuando traen valor (mismo criterio que
// cuota_mensual). Consecuencia: vaciar uno de estos campos al editar no lo
// borra en la BD; se quita cuando 0023 esté aplicada en todos los entornos.
const COLUMNAS_ONBOARDING_V2 = {
  nombreContacto: 'nombre_contacto',
  email: 'email',
  telefono: 'telefono',
  googleMaps: 'google_maps',
  redesEnlaces: 'redes_enlaces',
  porQueElegirnos: 'por_que_elegirnos',
  rangoPrecio: 'rango_precio',
  temas: 'temas',
  barrerasInternas: 'barreras_internas',
  barrerasExternas: 'barreras_externas',
  publicoObjetivo: 'publico_objetivo',
  queBuscan: 'que_buscan',
  competidores: 'competidores',
  cuentasReferencia: 'referencias',
  ritmoPublicacion: 'frecuencia',
}

// Red de seguridad si el front se despliega antes que 0023: PostgREST responde
// PGRST204 ("Could not find the 'x' column") y se reintenta una vez sin las
// columnas nuevas, para no perder el guardado del resto del cliente.
function esColumnaDesconocida(error) {
  return error?.code === 'PGRST204' || /could not find the '.*' column/i.test(error?.message || '')
}

// marca_personal (0041) tiene su propio reintento: si solo falta esa columna,
// se guarda el resto sin perder las del onboarding v2.
async function guardarConReintento(ejecutar, row, contexto) {
  let res = await ejecutar(row)
  if (res.error && esColumnaDesconocida(res.error) && 'marca_personal' in row) {
    console.warn(`[useClientes] ${contexto}: falta la columna marca_personal (migración 0041), se guarda sin ella`)
    row = { ...row }
    delete row.marca_personal
    res = await ejecutar(row)
  }
  if (res.error && esColumnaDesconocida(res.error)) {
    console.warn(`[useClientes] ${contexto}: faltan columnas del onboarding v2 (migración 0023), se guarda sin ellas`)
    res = await ejecutar(sinColumnasV2(row))
  }
  return res
}

function sinColumnasV2(row) {
  const copia = { ...row }
  Object.values(COLUMNAS_ONBOARDING_V2).forEach(col => { delete copia[col] })
  return copia
}

function limpiarValorV2(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim()
  if (Array.isArray(v)) {
    const arr = v.map(x => (typeof x === 'string' ? x.trim() : x)).filter(x => x !== '' && x != null)
    return arr.length ? arr : null
  }
  if (typeof v === 'object') {
    const obj = Object.fromEntries(Object.entries(v)
      .map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])
      .filter(([, x]) => x !== '' && x != null))
    return Object.keys(obj).length ? obj : null
  }
  return v
}

export function clienteDataParaDB(datos) {
  const row = {
    nombre: datos.nombre,
    foto_url: datos.fotoUrl || null,
    sector: datos.sector || '',
    sector_custom: datos.sectorCustom || null,
    web: datos.web || datos.webCarta || null,
    descripcion: datos.descripcion || null,
    diferencial: datos.diferencial || null,
    ubicacion: datos.ubicacion || null,
    ticket_medio: datos.ticketMedio || null,
    audiencia: datos.audiencia || {},
    tono: datos.tonoId || datos.tono || null,
    tono_descripcion: datos.tonoDescripcion || datos.vozPropia || null,
    energia: datos.energia || null,
    voz_genero: datos.vozGenero || null,
    uso_emojis: datos.usoEmojis || null,
    estilo_texto: datos.estiloTexto || [],
    prohibido: datos.prohibido || null,
    redes: datos.redesDetalladas || (Array.isArray(datos.redes) ? {} : datos.redes) || {},
    historial: datos.historial || {},
    fechas_clave: datos.fechasClaveObj || datos.fechasClave || {},
    identidad_visual: datos.identidadVisual || {},
    texto_videos: datos.textoVideos || {},
    videos_cliente: datos.videosCliente || [],
    videos_referencia: datos.videosReferencia || [],
    perfil_comunicacion: datos.perfilComunicacion || null,
    organizacion_id: datos.organizacionId || null,
  }
  // cuota_mensual llega con la migración 0020: mientras no se haya ejecutado,
  // PostgREST rechaza la columna, así que solo se envía cuando hay valor
  // (los guardados de perfil de clientes sin cuota no la incluyen).
  if (datos.cuotaMensual !== undefined && datos.cuotaMensual !== null && datos.cuotaMensual !== '') {
    row.cuota_mensual = Number(datos.cuotaMensual) || 0
  }
  Object.entries(COLUMNAS_ONBOARDING_V2).forEach(([clave, columna]) => {
    const valor = limpiarValorV2(datos[clave])
    if (valor !== null) row[columna] = valor
  })
  // modo_cobro (0026): solo se envía si está definido (null incluido = "como
  // la organización"); sin la migración, las filas lo traen undefined.
  if (datos.modoCobro !== undefined) row.modo_cobro = datos.modoCobro
  // marca_personal (0041): objeto = marca personal; false = el formulario la
  // quita (se escribe null). null/undefined no se envía, para no tocar la
  // columna en guardados que no vienen del formulario de perfil.
  if (datos.marcaPersonal) row.marca_personal = datos.marcaPersonal
  else if (datos.marcaPersonal === false) row.marca_personal = null
  return row
}

// ── CRUD: Supabase path or localStorage path ──────────────────────────────────

export async function getClientes() {
  if (!supabase) return { data: lsClientes(), error: null }
  try {
    const { data, error } = await supabase
      .from('clientes').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return { data: data.map(mapearCliente), error: null }
  } catch (error) {
    console.warn('[useClientes] Supabase no disponible, usando localStorage:', error.message)
    return { data: lsClientes(), error: null }
  }
}

export async function getCliente(id) {
  if (!supabase) {
    const found = lsClientes().find(c => String(c.id) === String(id))
    return { data: found || null, error: found ? null : new Error('No encontrado') }
  }
  const { data, error } = await supabase
    .from('clientes').select('*').eq('id', id).single()
  if (error) { console.error('getCliente:', error); return { data: null, error } }
  return { data: mapearCliente(data), error: null }
}

export async function crearCliente(datos) {
  if (!supabase) {
    const current = lsClientes()
    const nuevo = {
      ...datos,
      id: datos.id || Date.now(),
      color: datos.color || SECTOR_COLORS[datos.sector] || '#1D5FE0',
      ultimaActividad: 'Ahora mismo',
      postsEsteMes: 0,
      creadoEn: new Date().toISOString(),
    }
    lsSave([nuevo, ...current])
    return { data: nuevo, error: null }
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const row = { ...clienteDataParaDB(datos), user_id: user.id }
    const { data, error } = await guardarConReintento(
      r => supabase.from('clientes').insert(r).select().single(), row, 'crearCliente')
    if (error) throw error
    window.dispatchEvent(new CustomEvent('aify:clientes'))
    return { data: mapearCliente(data), error: null }
  } catch (error) {
    console.warn('[useClientes] Supabase no disponible, guardando en localStorage:', error.message)
    const current = lsClientes()
    const nuevo = {
      ...datos,
      id: datos.id || Date.now(),
      color: datos.color || SECTOR_COLORS[datos.sector] || '#1D5FE0',
      ultimaActividad: 'Ahora mismo',
      postsEsteMes: 0,
      creadoEn: new Date().toISOString(),
    }
    lsSave([nuevo, ...current])
    return { data: nuevo, error: null }
  }
}

export async function actualizarCliente(id, datos) {
  if (!supabase) {
    const current = lsClientes()
    const updated = current.map(c =>
      String(c.id) === String(id) ? { ...c, ...datos, ultimaActividad: 'Hoy' } : c
    )
    lsSave(updated)
    return { data: updated.find(c => String(c.id) === String(id)), error: null }
  }
  try {
    const row = { ...clienteDataParaDB(datos), updated_at: new Date().toISOString() }
    // clienteDataParaDB solo mapea los campos del formulario de perfil — un
    // flag de estado como "archivado" no pertenece a ese whitelist fijo, así
    // que se añade aparte y solo cuando el caller lo pasa explícitamente
    // (evita pisar el archivado real con undefined en un guardado normal de
    // perfil que no toca esto).
    if (datos.archivado !== undefined) row.archivado = datos.archivado
    const { data, error } = await guardarConReintento(
      r => supabase.from('clientes').update(r).eq('id', id).select().single(), row, 'actualizarCliente')
    if (error) { error.esRespuestaSupabase = true; throw error }
    window.dispatchEvent(new CustomEvent('aify:clientes'))
    return { data: mapearCliente(data), error: null }
  } catch (error) {
    if (error?.esRespuestaSupabase) {
      // Supabase respondió (no está caído/offline) y rechazó el guardado —
      // p.ej. una columna que aún no existe en la tabla real, una violación
      // de RLS, etc. Caer a localStorage aquí sería peor que no hacer nada:
      // getCliente()/getClientes() siguen leyendo de Supabase mientras esté
      // disponible, así que ese guardado local nunca se vuelve a leer y el
      // cambio "desaparece" al recargar sin que el caller se entere de que
      // falló (justo el bug de la foto de cliente que no se guardaba).
      console.error('[useClientes] actualizarCliente: Supabase rechazó el guardado, no se persistió:', error.message)
      return { data: null, error }
    }
    console.warn('[useClientes] Supabase no disponible, actualizando en localStorage:', error.message)
    const current = lsClientes()
    const updated = current.map(c =>
      String(c.id) === String(id) ? { ...c, ...datos, ultimaActividad: 'Hoy' } : c
    )
    lsSave(updated)
    return { data: updated.find(c => String(c.id) === String(id)), error: null }
  }
}

// Guarda la "Voz del cliente" (0031_voz_cliente.sql). Va aparte de
// actualizarCliente() por lo mismo que regenerarFeedToken: clienteDataParaDB
// reescribe todo el perfil, y aquí solo cambia esta lista. `faltaMigracion`
// permite a la tarjeta explicar por qué no se guarda si 0031 no está aplicada.
export async function guardarVozCliente(id, vozCliente) {
  if (!supabase) {
    const current = lsClientes()
    const updated = current.map(c => String(c.id) === String(id) ? { ...c, vozCliente } : c)
    lsSave(updated)
    return { data: updated.find(c => String(c.id) === String(id)), error: null }
  }
  const { data, error } = await supabase
    .from('clientes').update({ voz_cliente: vozCliente }).eq('id', id).select().single()
  if (error) {
    console.error('[useClientes] guardarVozCliente:', error.message)
    return { data: null, error, faltaMigracion: esColumnaDesconocida(error) }
  }
  window.dispatchEvent(new CustomEvent('aify:clientes'))
  return { data: mapearCliente(data), error: null }
}

// Rota el token del feed .ics de este cliente — invalida cualquier
// suscripción de calendario ya creada con el enlace anterior. Va aparte de
// actualizarCliente() porque no pasa por clienteDataParaDB (ese whitelist es
// para el formulario de perfil, esto es una acción propia).
export async function regenerarFeedToken(id) {
  const nuevoToken = crypto.randomUUID()
  if (!supabase) {
    const current = lsClientes()
    const updated = current.map(c => String(c.id) === String(id) ? { ...c, feedToken: nuevoToken } : c)
    lsSave(updated)
    return { data: updated.find(c => String(c.id) === String(id)), error: null }
  }
  const { data, error } = await supabase
    .from('clientes').update({ feed_token: nuevoToken }).eq('id', id).select().single()
  if (error) { console.error('[useClientes] regenerarFeedToken:', error.message); return { data: null, error } }
  return { data: mapearCliente(data), error: null }
}

export async function eliminarCliente(id) {
  if (!supabase) {
    const current = lsClientes()
    lsSave(current.filter(c => String(c.id) !== String(id)))
    return { error: null }
  }
  try {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw error
    window.dispatchEvent(new CustomEvent('aify:clientes'))
    return { error: null }
  } catch (error) {
    console.warn('[useClientes] Supabase no disponible, eliminando de localStorage:', error.message)
    const current = lsClientes()
    lsSave(current.filter(c => String(c.id) !== String(id)))
    return { error: null }
  }
}

export async function duplicarCliente(id) {
  const { data: original, error } = await getCliente(id)
  if (error || !original) return { data: null, error: error || new Error('No encontrado') }
  const copy = { ...original, nombre: `Copia de ${original.nombre}` }
  delete copy.id
  return crearCliente(copy)
}

// ── Tablero de clientes (migración 0024) ─────────────────────────────────────
// Van aparte de actualizarCliente(): no pasan por el whitelist del formulario
// de perfil ni tocan updated_at (mover una tarjeta no es "actividad").

export async function actualizarEtapaCliente(id, etapaId, etapaOrden) {
  if (!supabase) {
    lsSave(lsClientes().map(c => String(c.id) === String(id) ? { ...c, etapaId, etapaOrden } : c))
    return { error: null }
  }
  const { error } = await supabase.from('clientes').update({ etapa_id: etapaId, etapa_orden: etapaOrden }).eq('id', id)
  if (error) console.error('[useClientes] actualizarEtapaCliente:', error.message)
  return { error }
}

export async function moverClientesDeEtapa(desdeId, hastaId) {
  if (!supabase) {
    lsSave(lsClientes().map(c => String(c.etapaId) === String(desdeId) ? { ...c, etapaId: hastaId } : c))
    return { error: null }
  }
  const { error } = await supabase.from('clientes').update({ etapa_id: hastaId }).eq('etapa_id', desdeId)
  if (error) console.error('[useClientes] moverClientesDeEtapa:', error.message)
  return { error }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useClientesList() {
  // When no Supabase: initialize synchronously from localStorage (no flash)
  const [clientes, setClientesState] = useState(() => supabase ? [] : lsClientes())
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!supabase) {
      setClientesState(lsClientes())
      return
    }
    setLoading(true)
    const { data, error: err } = await getClientes()
    setClientesState(data)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) {
      // Listen for localStorage changes from CRUD operations
      const h = () => setClientesState(lsClientes())
      window.addEventListener('aify:clientes', h)
      return () => window.removeEventListener('aify:clientes', h)
    }
    refetch()
    // Con Supabase, este hook solo hacía el fetch inicial — un cliente
    // renombrado/creado/borrado en otra pestaña de la app (p.ej. desde su
    // Perfil) no se reflejaba nunca aquí, porque Sidebar.jsx monta este hook
    // una sola vez para toda la sesión y nada volvía a llamar a refetch().
    // crearCliente/actualizarCliente/eliminarCliente ahora emiten el mismo
    // evento 'aify:clientes' que ya usaba el modo local, así que basta con
    // escucharlo también aquí.
    window.addEventListener('aify:clientes', refetch)
    return () => window.removeEventListener('aify:clientes', refetch)
  }, [refetch])

  return { clientes, loading, error, refetch }
}
