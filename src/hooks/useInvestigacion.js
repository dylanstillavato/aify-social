import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../services/supabase'

// Investigación mensual por cliente (ver supabase/migrations/0025_investigacion.sql):
//   - investigaciones: una fila por cliente y mes, contenido libre en `datos` (jsonb)
//   - fechas_marcadas: fechas fijadas en el calendario del cliente
//   - bucket 'moodboards': imágenes del moodboard, ruta <org>/<cliente>/<uuid>.<ext>
// Sin Supabase configurado todo vive en localStorage (imágenes como data-URL
// dentro de `datos`). Con Supabase, un error se devuelve al caller en vez de
// caer a localStorage: un guardado local que nunca se vuelve a leer sería peor.

const LS_INVESTIGACIONES = 'aify_investigaciones'
const LS_FECHAS = 'aify_fechas_marcadas'
const EVENTO_FECHAS = 'aify:fechas_marcadas'
const BUCKET = 'moodboards'
const URL_FIRMADA_SEGUNDOS = 3600

const pad = n => String(n).padStart(2, '0')

function lsLeer(key, porDefecto) {
  try {
    const s = localStorage.getItem(key)
    return s !== null ? JSON.parse(s) : porDefecto
  } catch { return porDefecto }
}

function lsGuardar(key, valor) {
  try {
    localStorage.setItem(key, JSON.stringify(valor))
    return null
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
      return new Error('El almacenamiento local está lleno. Quita alguna imagen del moodboard.')
    }
    return e
  }
}

const claveLocal = (clienteId, anio, mes) => `${clienteId}:${anio}-${pad(mes)}`

async function usuarioActual() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Debes iniciar sesión')
  return user
}

// ── Investigación del mes ─────────────────────────────────────────────────────

export async function getInvestigacion(clienteId, anio, mes) {
  if (!supabase) {
    const todas = lsLeer(LS_INVESTIGACIONES, {})
    return { data: todas[claveLocal(clienteId, anio, mes)] || null, error: null }
  }
  const { data, error } = await supabase
    .from('investigaciones').select('*')
    .eq('cliente_id', clienteId).eq('anio', anio).eq('mes', mes)
    .maybeSingle()
  if (error) return { data: null, error }
  return { data: data?.datos || null, error: null }
}

// Update y, si no existía, insert. No se usa upsert para no pisar el user_id
// (autoría) de quien creó la fila cuando la edita un compañero.
export async function guardarInvestigacion({ clienteId, organizacionId, anio, mes, datos }) {
  if (!supabase) {
    const todas = lsLeer(LS_INVESTIGACIONES, {})
    todas[claveLocal(clienteId, anio, mes)] = datos
    return { error: lsGuardar(LS_INVESTIGACIONES, todas) }
  }
  const ahora = new Date().toISOString()
  const actualizar = () => supabase
    .from('investigaciones')
    .update({ datos, updated_at: ahora })
    .eq('cliente_id', clienteId).eq('anio', anio).eq('mes', mes)
    .select('id')
  const { data: filas, error: errUpd } = await actualizar()
  if (errUpd) return { error: errUpd }
  if (filas?.length) return { error: null }

  try {
    const user = await usuarioActual()
    const { error: errIns } = await supabase.from('investigaciones').insert({
      cliente_id: clienteId,
      organizacion_id: organizacionId || null,
      user_id: user.id,
      anio, mes, datos,
    })
    if (!errIns) return { error: null }
    // Otro guardado (u otra pestaña) creó la fila entre medias: se reintenta el update
    if (errIns.code === '23505') {
      const { error: errReint } = await actualizar()
      return { error: errReint }
    }
    return { error: errIns }
  } catch (error) {
    return { error }
  }
}

// Carga la investigación de (cliente, año, mes) y guarda los cambios con
// debounce. `setDatos(valor | updater)` actualiza al momento y programa el
// guardado; al cambiar de mes o desmontar, lo pendiente se guarda enseguida.
export function useInvestigacion({ clienteId, organizacionId, anio, mes, debounceMs = 800 }) {
  const clave = clienteId ? claveLocal(clienteId, anio, mes) : null
  const [estado, setEstado] = useState({ clave: null, datos: {}, existe: false, error: null })
  const [guardado, setGuardado] = useState('idle') // idle | pendiente | guardando | guardado | error
  const [errorGuardado, setErrorGuardado] = useState(null)

  const datosRef = useRef({})
  const claveRef = useRef(null)
  const timerRef = useRef(null)
  const pendienteRef = useRef(null)
  const colaRef = useRef(Promise.resolve())

  const ejecutarGuardado = useCallback((payload) => {
    // Los guardados se encadenan para que dos seguidos no compitan por el insert
    colaRef.current = colaRef.current.then(async () => {
      setGuardado('guardando')
      const { error } = await guardarInvestigacion(payload)
      if (error) {
        console.warn('[useInvestigacion] no se pudo guardar:', error.message)
        setErrorGuardado(error)
        setGuardado('error')
      } else {
        setErrorGuardado(null)
        setGuardado(g => (g === 'guardando' ? 'guardado' : g))
      }
    })
    return colaRef.current
  }, [])

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    const payload = pendienteRef.current
    pendienteRef.current = null
    if (payload) return ejecutarGuardado(payload)
    return colaRef.current
  }, [ejecutarGuardado])

  useEffect(() => {
    if (!clave) return undefined
    let cancelado = false
    claveRef.current = clave
    getInvestigacion(clienteId, anio, mes).then(({ data, error }) => {
      if (cancelado) return
      if (error) console.warn('[useInvestigacion] no se pudo cargar:', error.message)
      datosRef.current = data || {}
      setEstado({ clave, datos: data || {}, existe: !!data, error: error || null })
      setGuardado('idle')
    })
    return () => {
      cancelado = true
      flush()
    }
  }, [clave, clienteId, anio, mes, flush])

  const setDatos = useCallback((valorOUpdater) => {
    if (!clave || claveRef.current !== clave) return
    const siguiente = typeof valorOUpdater === 'function' ? valorOUpdater(datosRef.current) : valorOUpdater
    datosRef.current = siguiente
    setEstado(e => (e.clave === clave ? { ...e, datos: siguiente } : e))
    pendienteRef.current = { clienteId, organizacionId, anio, mes, datos: siguiente }
    setGuardado('pendiente')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { flush() }, debounceMs)
  }, [clave, clienteId, organizacionId, anio, mes, debounceMs, flush])

  const cargando = !!clave && estado.clave !== clave
  return {
    datos: cargando ? {} : estado.datos,
    existe: !cargando && estado.existe,
    cargando,
    errorCarga: cargando ? null : estado.error,
    setDatos,
    guardarAhora: flush,
    guardado,
    errorGuardado,
  }
}

// ── Fechas marcadas ───────────────────────────────────────────────────────────

function rangoMeses(anio, mes, meses = 1) {
  if (!anio || !mes) return null
  const fin = new Date(anio, mes - 1 + meses, 0) // último día del último mes
  return {
    desde: `${anio}-${pad(mes)}-01`,
    hasta: `${fin.getFullYear()}-${pad(fin.getMonth() + 1)}-${pad(fin.getDate())}`,
  }
}

export async function getFechasMarcadas(clienteId, { desde, hasta } = {}) {
  if (!supabase) {
    const todas = lsLeer(LS_FECHAS, [])
    const data = todas
      .filter(f => String(f.cliente_id) === String(clienteId))
      .filter(f => (!desde || f.fecha >= desde) && (!hasta || f.fecha <= hasta))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    return { data, error: null }
  }
  let q = supabase.from('fechas_marcadas').select('*').eq('cliente_id', clienteId)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  const { data, error } = await q.order('fecha', { ascending: true })
  return { data: data || [], error }
}

// fechas: [{ fecha: 'YYYY-MM-DD', titulo, origen?, notas? }]
export async function crearFechasMarcadas({ clienteId, organizacionId }, fechas) {
  const filas = (fechas || []).map(f => ({
    cliente_id: clienteId,
    organizacion_id: organizacionId || null,
    fecha: f.fecha,
    titulo: f.titulo,
    origen: f.origen || 'manual',
    notas: f.notas || null,
  }))
  if (filas.length === 0) return { data: [], error: null }
  if (!supabase) {
    const nuevas = filas.map(f => ({ ...f, id: crypto.randomUUID(), created_at: new Date().toISOString() }))
    const error = lsGuardar(LS_FECHAS, [...lsLeer(LS_FECHAS, []), ...nuevas])
    if (!error) window.dispatchEvent(new CustomEvent(EVENTO_FECHAS))
    return { data: error ? [] : nuevas, error }
  }
  try {
    const user = await usuarioActual()
    const { data, error } = await supabase
      .from('fechas_marcadas')
      .insert(filas.map(f => ({ ...f, user_id: user.id })))
      .select()
    if (!error) window.dispatchEvent(new CustomEvent(EVENTO_FECHAS))
    return { data: data || [], error }
  } catch (error) {
    return { data: [], error }
  }
}

export async function eliminarFechaMarcada(id) {
  if (!supabase) {
    const error = lsGuardar(LS_FECHAS, lsLeer(LS_FECHAS, []).filter(f => f.id !== id))
    if (!error) window.dispatchEvent(new CustomEvent(EVENTO_FECHAS))
    return { error }
  }
  const { error } = await supabase.from('fechas_marcadas').delete().eq('id', id)
  if (!error) window.dispatchEvent(new CustomEvent(EVENTO_FECHAS))
  return { error }
}

// Fechas marcadas de un cliente. Con anio/mes filtra a ese mes (o a `meses`
// meses seguidos desde él); sin ellos, devuelve todas. Pensado también para
// que el calendario las muestre fijadas. Se refresca solo cuando cualquier
// instancia añade o quita fechas (evento 'aify:fechas_marcadas').
export function useFechasMarcadas(clienteId, anio, mes, { meses = 1 } = {}) {
  const rango = rangoMeses(anio, mes, meses)
  const desde = rango?.desde
  const hasta = rango?.hasta
  const clave = clienteId ? `${clienteId}|${desde || ''}|${hasta || ''}` : null
  const [estado, setEstado] = useState({ clave: null, fechas: [], error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const h = () => setVersion(v => v + 1)
    window.addEventListener(EVENTO_FECHAS, h)
    return () => window.removeEventListener(EVENTO_FECHAS, h)
  }, [])

  useEffect(() => {
    if (!clave) return undefined
    let cancelado = false
    getFechasMarcadas(clienteId, { desde, hasta }).then(({ data, error }) => {
      if (cancelado) return
      if (error) console.warn('[useFechasMarcadas] no se pudieron cargar:', error.message)
      setEstado({ clave, fechas: data || [], error: error || null })
    })
    return () => { cancelado = true }
  }, [clave, clienteId, desde, hasta, version])

  const refetch = useCallback(() => setVersion(v => v + 1), [])
  const cargando = !!clave && estado.clave !== clave

  return {
    // Mientras se recarga el mismo rango se siguen mostrando las fechas previas
    fechas: estado.clave === clave ? estado.fechas : [],
    cargando,
    error: estado.clave === clave ? estado.error : null,
    refetch,
  }
}

// ── Moodboard (Supabase Storage) ──────────────────────────────────────────────

export const MOODBOARD_TIPOS = ['image/jpeg', 'image/png', 'image/webp']
export const MOODBOARD_MAX_BYTES = 5 * 1024 * 1024
export const MOODBOARD_MAX_LADO = 1600

// Reduce la imagen para que su lado largo mida como mucho `max` px (sin
// ampliar ni recortar). JPEG sale en JPEG; PNG/WebP en WebP (conserva la
// transparencia). Devuelve { blob, ext, ancho, alto }.
export function prepararImagenMoodboard(file, { max = MOODBOARD_MAX_LADO, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !MOODBOARD_TIPOS.includes(file.type)) {
      reject(new Error('Formato no admitido. Usa JPG, PNG o WebP'))
      return
    }
    if (file.size > MOODBOARD_MAX_BYTES) {
      reject(new Error(`"${file.name}" pesa más de 5 MB`))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer "${file.name}"`)) }
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w0 = img.naturalWidth || img.width
      const h0 = img.naturalHeight || img.height
      const escala = Math.min(1, max / Math.max(w0, h0))
      const ancho = Math.max(1, Math.round(w0 * escala))
      const alto = Math.max(1, Math.round(h0 * escala))
      const canvas = document.createElement('canvas')
      canvas.width = ancho
      canvas.height = alto
      const ctx = canvas.getContext('2d')
      const esJpeg = file.type === 'image/jpeg'
      if (esJpeg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, ancho, alto) }
      ctx.drawImage(img, 0, 0, ancho, alto)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('No se pudo procesar la imagen')); return }
        // Safari antiguo no codifica WebP y devuelve PNG: la extensión sigue al blob real
        const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
        resolve({ blob, ext, ancho, alto })
      }, esJpeg ? 'image/jpeg' : 'image/webp', quality)
    }
    img.src = url
  })
}

function blobADataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('No se pudo leer la imagen'))
    r.onload = () => resolve(r.result)
    r.readAsDataURL(blob)
  })
}

// Cacheada por usuario (si se cambia de cuenta sin recargar, se vuelve a pedir)
let orgIdCache = { userId: null, orgId: null }
async function miOrganizacionId() {
  const user = await usuarioActual()
  if (orgIdCache.userId === user.id && orgIdCache.orgId) return orgIdCache.orgId
  const { data, error } = await supabase.rpc('mi_organizacion_id')
  if (error) throw error
  if (!data) throw new Error('Tu cuenta no tiene organización todavía. Recarga la página e inténtalo de nuevo.')
  orgIdCache = { userId: user.id, orgId: data }
  return data
}

// Sube una imagen al moodboard. Devuelve el item para guardar en
// datos.moodboard: { id, path, ancho, alto, caption } con Supabase, o
// { id, dataUrl, ancho, alto, caption } en modo local.
export async function subirImagenMoodboard({ clienteId, file }) {
  const { blob, ext, ancho, alto } = await prepararImagenMoodboard(file)
  const id = crypto.randomUUID()
  if (!supabase) {
    return { id, dataUrl: await blobADataUrl(blob), ancho, alto, caption: '' }
  }
  // La política de storage exige que el primer segmento sea la organización del usuario
  const orgId = await miOrganizacionId()
  const path = `${orgId}/${clienteId}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type, cacheControl: '3600', upsert: false,
  })
  if (error) throw error
  return { id, path, ancho, alto, caption: '' }
}

export async function eliminarImagenMoodboard(item) {
  if (!item?.path || !supabase) return { error: null }
  urlsCache.delete(item.path)
  const { error } = await supabase.storage.from(BUCKET).remove([item.path])
  return { error }
}

// Caché de URLs firmadas por ruta (se renuevan 5 min antes de caducar)
const urlsCache = new Map()

async function firmarRutas(paths) {
  const ahora = Date.now()
  const faltan = paths.filter(p => {
    const c = urlsCache.get(p)
    return !c || c.expira - ahora < 5 * 60 * 1000
  })
  if (faltan.length && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(faltan, URL_FIRMADA_SEGUNDOS)
    if (error) throw error
    for (const d of data || []) {
      if (d.signedUrl && d.path) urlsCache.set(d.path, { url: d.signedUrl, expira: ahora + URL_FIRMADA_SEGUNDOS * 1000 })
    }
  }
  const out = {}
  for (const p of paths) { const c = urlsCache.get(p); if (c) out[p] = c.url }
  return out
}

// URLs firmadas (1 h) para mostrar los items del moodboard. Devuelve un mapa
// id -> src; en modo local el src es directamente el data-URL del item.
export function useUrlsMoodboard(items) {
  const lista = Array.isArray(items) ? items : []
  const paths = lista.filter(i => i?.path).map(i => i.path)
  const clave = paths.join('|')
  const [firmadas, setFirmadas] = useState({})

  useEffect(() => {
    if (!clave || !supabase) return undefined
    let cancelado = false
    firmarRutas(clave.split('|'))
      .then(urls => { if (!cancelado) setFirmadas(prev => ({ ...prev, ...urls })) })
      .catch(err => console.warn('[useUrlsMoodboard] no se pudieron firmar las URLs:', err.message))
    // Renueva antes de que caduquen si la pestaña sigue abierta
    const t = setInterval(() => {
      firmarRutas(clave.split('|'))
        .then(urls => { if (!cancelado) setFirmadas(prev => ({ ...prev, ...urls })) })
        .catch(() => {})
    }, 50 * 60 * 1000)
    return () => { cancelado = true; clearInterval(t) }
  }, [clave])

  const srcPorId = {}
  for (const i of lista) {
    if (i?.dataUrl) srcPorId[i.id] = i.dataUrl
    else if (i?.path) srcPorId[i.id] = firmadas[i.path] || null
  }
  return srcPorId
}
