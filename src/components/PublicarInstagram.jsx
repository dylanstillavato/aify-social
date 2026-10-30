import { useEffect, useRef, useState } from 'react'
import { Send, ExternalLink, X, Sparkles } from 'lucide-react'
import { generarCopies, sugerirHoraPublicacion } from '../services/ai'
import { getCliente } from '../hooks/useClientes'
import { supabase } from '../services/supabase'
import {
  getMetricasInstagram,
  getPublicacionesInstagram, programarPublicacionInstagram, cancelarPublicacionInstagram, conectarInstagram,
  BUCKET_PUBLICACIONES,
} from '../services/instagram'
import { esPostTrial } from '../utils/trialReels'
import { formatoDe, esHistoria } from '../utils/formato'

// "Publicar en Instagram" dentro del panel de un post del calendario.
// Sube los archivos al bucket privado "publicaciones" y le pasa al servidor
// las rutas y la hora; el proceso de server.js publica cuando toca.

const TIPOS = [
  { id: 'post', texto: 'Post' },
  { id: 'carrusel', texto: 'Carrusel' },
  { id: 'reel', texto: 'Reel' },
  { id: 'historia', texto: 'Historia' },
]
const MAX_CAPTION = 2200
const MAX_LADO_IMAGEN = 1440
const AVISO_TAMAÑO_VIDEO = 50 * 1024 * 1024 // límite por archivo del plan gratuito de Supabase

const etiqueta = { fontSize: 10, fontWeight: 600, color: '#86868B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }
const campo = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F9F9FB', color: '#1D1D1F' }
const boton = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#F9F9FB', color: '#1D1D1F', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }
const botonPrincipal = { ...boton, border: 'none', background: '#1D1D1F', color: '#fff', fontWeight: 600 }
const nota = { fontSize: 11, color: '#86868B', lineHeight: 1.45, margin: 0 }
const caja = (fondo, color) => ({ fontSize: 12, lineHeight: 1.45, padding: '8px 10px', borderRadius: 8, background: fondo, color, margin: '0 0 8px' })

function tipoInicial(post) {
  if (esHistoria(post)) return 'historia'
  return formatoDe(post) === 'carrusel' ? 'carrusel' : 'reel'
}

function captionInicial(post) {
  return [post.copy, post.hashtags].filter(Boolean).join('\n\n').slice(0, MAX_CAPTION)
}

function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Meta solo acepta JPEG: cualquier imagen se redibuja en un canvas y se exporta
// como JPEG (con el lado largo limitado a 1440 px, el máximo que usa Instagram).
async function aJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, MAX_LADO_IMAGEN / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error(`No se pudo convertir ${file.name} a JPEG`)
  return blob
}

const esVideo = (file) => file.type.startsWith('video/')

async function subirArchivo(file, prefijo) {
  const video = esVideo(file)
  const blob = video ? file : await aJpeg(file)
  const ext = video ? (file.type === 'video/quicktime' ? 'mov' : 'mp4') : 'jpg'
  const ruta = `${prefijo}${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_PUBLICACIONES).upload(ruta, blob, {
    contentType: video ? file.type : 'image/jpeg', upsert: false,
  })
  if (error) throw new Error(`No se pudo subir ${file.name}: ${error.message}`)
  // nombre y tamaño originales: salen en el resumen de lo programado
  return { ruta, tipo: video ? 'video' : 'imagen', nombre: file.name.slice(0, 255), bytes: file.size }
}

function validar(tipo, archivos) {
  if (tipo === 'carrusel') {
    if (archivos.length < 2 || archivos.length > 10) return 'Un carrusel lleva entre 2 y 10 archivos.'
    return null
  }
  if (archivos.length !== 1) return 'Elige un archivo.'
  if (tipo === 'post' && esVideo(archivos[0])) return 'Un post lleva una imagen. Para un vídeo, elige Reel.'
  if (tipo === 'reel' && !esVideo(archivos[0])) return 'Un reel lleva un vídeo.'
  return null
}

function Estado({ pub, onCancelar, cancelando }) {
  if (pub.estado === 'programado') {
    return (
      <div style={caja('rgba(0,122,255,0.08)', '#0A58CA')}>
        Se publicará el {fechaHora(pub.publicar_en)}.
        {pub.error && <div style={{ marginTop: 4 }}>{pub.error}</div>}
        <div style={{ marginTop: 6 }}>
          <button type="button" style={boton} onClick={onCancelar} disabled={cancelando}><X size={12} /> {cancelando ? 'Cancelando…' : 'Cancelar'}</button>
        </div>
      </div>
    )
  }
  if (pub.estado === 'procesando') return <p style={caja('rgba(255,159,10,0.10)', '#A05A00')}>Publicando en Instagram…</p>
  if (pub.estado === 'publicado') {
    return (
      <p style={caja('rgba(48,164,108,0.10)', '#1F7A4D')}>
        Publicado{pub.publicado_en ? ` el ${fechaHora(pub.publicado_en)}` : ''}.{' '}
        {pub.permalink && (
          <a href={pub.permalink} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            Ver en Instagram <ExternalLink size={11} />
          </a>
        )}
      </p>
    )
  }
  if (pub.estado === 'error') return <p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>No se pudo publicar: {pub.error || 'error desconocido'}. Puedes volver a programarlo.</p>
  return null
}

const NOMBRE_TIPO = { post: 'Post de foto', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' }

// Lo que Instagram devuelve como media_product_type para cada tipo de Aify.
const PRODUCTO_ESPERADO = { post: 'FEED', carrusel: 'FEED', reel: 'REELS', historia: 'STORY' }
const NOMBRE_PRODUCTO = { FEED: 'publicación del feed', REELS: 'reel', STORY: 'historia' }

const megas = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

function formatoProgramado(pub) {
  if (pub.tipo !== 'reel') return NOMBRE_TIPO[pub.tipo] || pub.tipo
  if (!pub.es_trial) return 'Reel normal (lo ven tus seguidores)'
  return `Trial Reel (primero solo no seguidores) · ${pub.trial_graduacion === 'SS_PERFORMANCE' ? 'pasa a los seguidores solo si funciona' : 'a los seguidores lo pasas tú desde Instagram'}`
}

function BotonVer({ ruta }) {
  const [cargando, setCargando] = useState(false)
  const ver = async () => {
    setCargando(true)
    const ventana = window.open('', '_blank')
    const { data } = await supabase.storage.from(BUCKET_PUBLICACIONES).createSignedUrl(ruta, 10 * 60)
    setCargando(false)
    if (data?.signedUrl && ventana) ventana.location.href = data.signedUrl
    else ventana?.close()
  }
  return (
    <button type="button" onClick={ver} disabled={cargando}
      style={{ background: 'none', border: 'none', padding: 0, marginLeft: 6, color: '#1D5FE0', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
      {cargando ? 'Abriendo…' : 'Ver'}
    </button>
  )
}

// Resumen de lo que se programó (y, una vez publicado, lo que Instagram dice
// que publicó), para ver de un vistazo si hay que corregir y republicar.
function Resumen({ pub }) {
  const [textoEntero, setTextoEntero] = useState(false)
  const fila = (nombre, valor) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ width: 62, flexShrink: 0, color: '#86868B' }}>{nombre}</span>
      <span style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>{valor}</span>
    </div>
  )
  const archivos = pub.archivos || []
  const caption = pub.caption || ''
  const ig = pub.instagram
  const esperado = PRODUCTO_ESPERADO[pub.tipo]
  const noCoincide = ig?.producto && ig.producto !== esperado
  const feedDistinto = pub.tipo === 'reel' && ig?.en_feed != null && ig.en_feed !== pub.compartir_en_feed

  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, color: '#1D1D1F', padding: '9px 10px', borderRadius: 8, border: '1px solid #E5E5EA', margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...etiqueta, marginBottom: 2 }}>{pub.estado === 'publicado' ? 'Lo que se publicó' : 'Lo que se va a publicar'}</div>
      {fila('Formato', formatoProgramado(pub))}
      {pub.tipo === 'reel' && fila('Feed', pub.compartir_en_feed ? 'También sale en el feed' : 'Solo en la pestaña de reels')}
      {fila(archivos.length > 1 ? 'Archivos' : 'Archivo', (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {archivos.map((a, i) => (
            <span key={a.ruta}>
              {archivos.length > 1 && `${i + 1}. `}
              {a.nombre || <span style={{ color: '#86868B' }}>{a.tipo === 'video' ? 'Vídeo' : 'Imagen'} (nombre no guardado: se programó antes de este resumen)</span>}
              {a.bytes ? <span style={{ color: '#86868B' }}> · {megas(a.bytes)}</span> : null}
              {pub.archivos_borrados || pub.estado === 'publicado' ? <span style={{ color: '#86868B' }}> · borrado de Aify al publicarse</span> : <BotonVer ruta={a.ruta} />}
            </span>
          ))}
        </span>
      ))}
      {pub.tipo === 'reel' && fila('Portada', pub.portada_ruta
        ? <span>{pub.portada_nombre || 'Imagen propia'}{!pub.archivos_borrados && pub.estado !== 'publicado' && <BotonVer ruta={pub.portada_ruta} />}</span>
        : 'La elige Instagram (primer fotograma)')}
      {pub.tipo !== 'historia' && fila('Texto', caption
        ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {textoEntero || caption.length <= 140 ? caption : `${caption.slice(0, 140)}…`}
            {caption.length > 140 && (
              <button type="button" onClick={() => setTextoEntero(v => !v)}
                style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, color: '#1D5FE0', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                {textoEntero ? 'Ver menos' : 'Ver todo'}
              </button>
            )}
          </span>
        )
        : <span style={{ color: '#C4271D' }}>Sin texto</span>)}
      {fila('Cuándo', fechaHora(pub.estado === 'publicado' && pub.publicado_en ? pub.publicado_en : pub.publicar_en))}

      {pub.estado === 'publicado' && (
        ig?.producto ? (
          <div style={{ ...caja(noCoincide || feedDistinto ? 'rgba(255,59,48,0.08)' : 'rgba(48,164,108,0.10)', noCoincide || feedDistinto ? '#C4271D' : '#1F7A4D'), margin: '4px 0 0' }}>
            {noCoincide
              ? `Ojo: se programó como ${NOMBRE_TIPO[pub.tipo].toLowerCase()} e Instagram lo ha publicado como ${NOMBRE_PRODUCTO[ig.producto] || ig.producto}. Bórralo en Instagram y vuelve a programarlo.`
              : feedDistinto
                ? `Ojo: Instagram dice que ${ig.en_feed ? 'sí' : 'no'} sale en el feed, y se programó al revés.`
                : `Comprobado en Instagram: ${NOMBRE_PRODUCTO[ig.producto] || ig.producto}${pub.tipo === 'reel' && ig.en_feed != null ? (ig.en_feed ? ', también en el feed' : ', solo en reels') : ''}.`}
            {pub.es_trial && !noCoincide && ' Instagram no confirma por la API si salió como Trial: compruébalo en la app.'}
          </div>
        ) : (
          <p style={{ ...nota, marginTop: 4 }}>Instagram no devolvió el tipo de publicación; revísalo con «Ver en Instagram».</p>
        )
      )}
    </div>
  )
}

// "Generar con IA": 3 variantes de texto con la voz del cliente (generarCopies,
// el mismo generador de copies del resto de Aify). Al elegir una, rellena el texto.
function GeneradorTexto({ clienteId, cliente, post, tipo, onElegir }) {
  const [estado, setEstado] = useState(null) // null | 'cargando' | { variantes } | { error }

  const generar = async () => {
    setEstado('cargando')
    try {
      const datosCliente = cliente || (await getCliente(clienteId)).data
      if (!datosCliente) throw new Error('No se encontró el cliente')
      const guion = post.guion || {}
      const descripcion = [
        `${NOMBRE_TIPO[tipo] || 'Publicación'} de Instagram`,
        post.titulo, post.concepto, post.objetivo && `Objetivo: ${post.objetivo}`,
        guion.gancho && `Gancho del vídeo: ${guion.gancho}`,
      ].filter(Boolean).join('. ')
      const variantes = await generarCopies(datosCliente, 'instagram', descripcion)
      if (!variantes?.length) throw new Error('La IA no ha devuelto ningún texto')
      setEstado({ variantes })
    } catch (err) {
      setEstado({ error: err.message || 'No se pudo generar el texto' })
    }
  }

  const cargando = estado === 'cargando'
  return (
    <>
      <button type="button" onClick={generar} disabled={cargando}
        style={{ ...boton, padding: '4px 9px', fontSize: 11, opacity: cargando ? 0.7 : 1 }}>
        <Sparkles size={12} /> {cargando ? 'Generando…' : estado?.variantes ? 'Otras opciones' : 'Generar con IA'}
      </button>
      {estado?.error && <p style={{ ...caja('rgba(255,59,48,0.08)', '#C4271D'), marginTop: 6, width: '100%' }}>{estado.error}</p>}
      {estado?.variantes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, width: '100%' }}>
          {estado.variantes.map(v => (
            <button key={v.id} type="button"
              onClick={() => { onElegir([v.copy, v.hashtags].filter(Boolean).join('\n\n')); setEstado(null) }}
              style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFFFFF', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{v.variante}</div>
              <div style={{ fontSize: 12, color: '#1D1D1F', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{v.copy}</div>
              {v.hashtags && <div style={{ fontSize: 11, color: '#1D5FE0', marginTop: 3 }}>{v.hashtags}</div>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// Horas sugeridas por IA (mañana y tarde), una vez por cliente + día + formato en cada sesión.
const horasSugeridas = new Map()

async function pedirHoraSugerida(clienteId, cliente, { fecha, tipo, titulo }) {
  const clave = `${clienteId}|${fecha}|${tipo}`
  if (!horasSugeridas.has(clave)) {
    const promesa = (async () => {
      const datosCliente = cliente || (await getCliente(clienteId)).data
      if (!datosCliente) throw new Error('No se encontró el cliente')
      // Datos reales: hora y alcance de las últimas publicaciones (de la caché de métricas)
      let historial = []
      try {
        const m = await getMetricasInstagram(clienteId)
        historial = (m.publicaciones || []).slice(0, 12).map(p => ({
          cuando: new Date(p.fecha).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit' }),
          tipo: p.tipo, alcance: p.alcance,
        }))
      } catch { /* sin métricas: la IA sugiere sin datos */ }
      return sugerirHoraPublicacion(datosCliente, { fecha, tipo: NOMBRE_TIPO[tipo] || tipo, titulo, historial })
    })()
    horasSugeridas.set(clave, promesa)
    promesa.catch(() => horasSugeridas.delete(clave))
  }
  return horasSugeridas.get(clave)
}

const FRANJAS = [
  { id: 'manana', texto: 'Mañana' },
  { id: 'tarde', texto: 'Tarde' },
]

// onCambiar({ fecha?, hora? }): el día y la hora del formulario se guardan en
// el post (con un pequeño retraso), así el calendario se mueve a la vez.
export default function PublicarInstagram({ clienteId, post, cliente = null, abiertoInicial = false, onCambiar = null }) {
  const [recarga, setRecarga] = useState(0)
  const clave = `${clienteId}|${post.id}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [tipo, setTipo] = useState(() => tipoInicial(post))
  const [archivos, setArchivos] = useState([])
  const [portada, setPortada] = useState(null)
  const [enFeed, setEnFeed] = useState(true)
  // Trial Reel: los posts creados desde "Variantes Trial" la traen marcada.
  const [esTrial, setEsTrial] = useState(() => esPostTrial(post))
  const [graduacion, setGraduacion] = useState('MANUAL')
  const [caption, setCaption] = useState(() => captionInicial(post))
  const [fecha, setFecha] = useState(post.fecha || '')
  const [hora, setHora] = useState(post.hora ? post.hora.slice(0, 5) : '12:00')
  // Si el post se mueve desde el calendario (arrastrándolo), el formulario lo sigue.
  const [fechaDelPost, setFechaDelPost] = useState(post.fecha)
  if (post.fecha !== fechaDelPost) {
    setFechaDelPost(post.fecha)
    setFecha(post.fecha || '')
  }
  const onCambiarRef = useRef(onCambiar)
  useEffect(() => { onCambiarRef.current = onCambiar })
  // La hora solo se guarda cuando alguien la ha elegido (a mano o la IA), no el 12:00 por defecto.
  const [horaElegida, setHoraElegida] = useState(Boolean(post.hora))
  useEffect(() => {
    if (!onCambiarRef.current || !fecha) return
    const cambios = {}
    if (fecha !== post.fecha) cambios.fecha = fecha
    if (horaElegida && hora && hora !== (post.hora || '').slice(0, 5)) cambios.hora = hora
    if (!Object.keys(cambios).length) return
    const t = setTimeout(() => onCambiarRef.current?.(cambios), 600)
    return () => clearTimeout(t)
  }, [fecha, hora, horaElegida, post.fecha, post.hora])
  // Si el post no tenía hora, la sugerida por la IA se aplica sola hasta que se toque a mano.
  const [horaTocada, setHoraTocada] = useState(Boolean(post.hora))
  const claveSugerencia = `${fecha}|${tipo}`
  const [sugerencia, setSugerencia] = useState(null) // { clave, manana?, tarde?, mejor?, error? }
  useEffect(() => {
    if (!abierto || !fecha) return
    let activo = true
    const t = setTimeout(() => {
      pedirHoraSugerida(clienteId, cliente, { fecha, tipo, titulo: post.titulo })
        .then(r => {
          if (!activo) return
          setSugerencia({ clave: claveSugerencia, ...r })
          if (!horaTocada) { setHora(r[r.mejor].hora); setHoraElegida(true) }
        })
        .catch(err => { if (activo) setSugerencia({ clave: claveSugerencia, error: err.message }) })
    }, 400)
    return () => { activo = false; clearTimeout(t) }
  }, [abierto, fecha, tipo, clienteId, cliente, post.titulo, claveSugerencia, horaTocada])
  const sugerida = sugerencia?.clave === claveSugerencia ? sugerencia : null
  // Franja elegida: la de la hora puesta (antes de las 17:00 es mañana)
  const franja = hora && hora >= '17:00' ? 'tarde' : 'manana'
  const elegirFranja = (f) => {
    setHoraTocada(true); setHoraElegida(true)
    const h = sugerida?.[f]?.hora
    if (h) setHora(h)
    else setHora(f === 'tarde' ? (hora >= '17:00' ? hora : '19:00') : (hora < '17:00' ? hora : '12:00'))
  }
  const [progreso, setProgreso] = useState(null)
  const [error, setError] = useState(null)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    let activo = true
    getPublicacionesInstagram(clienteId)
      .then(data => { if (activo) setEstado({ clave, data }) })
      .catch(err => { if (activo) setEstado({ clave, error: err }) })
    return () => { activo = false }
  }, [clienteId, clave])

  const actual = estado?.clave === clave ? estado : null
  const pub = actual?.data?.publicaciones?.find(p => p.post_id === post.id) || null
  // Al cambiar una programación, el formulario parte de lo ya programado
  // (si no, la casilla de Trial salía desmarcada y se perdía al reprogramar).
  const versionPub = pub && pub.estado !== 'cancelado' ? `${pub.id}|${pub.actualizado_en}` : null
  const [pubCargada, setPubCargada] = useState(null)
  if (versionPub && versionPub !== pubCargada) {
    setPubCargada(versionPub)
    setTipo(pub.tipo)
    setEnFeed(pub.compartir_en_feed !== false)
    setEsTrial(Boolean(pub.es_trial))
    setGraduacion(pub.trial_graduacion || 'MANUAL')
    if (pub.caption != null) setCaption(pub.caption)
  }
  const recargar = () => setRecarga(r => r + 1)

  // Mientras se publica, se vuelve a mirar cada 15 s.
  useEffect(() => {
    if (pub?.estado !== 'procesando') return
    const id = setTimeout(() => setRecarga(r => r + 1), 15000)
    return () => clearTimeout(id)
  }, [pub?.estado, recarga])

  const programar = async () => {
    setError(null)
    const fallo = validar(tipo, archivos)
    if (fallo) return setError(fallo)
    if (!fecha || !hora) return setError('Pon la fecha y la hora de publicación.')
    const publicarEn = new Date(`${fecha}T${hora}:00`)
    if (Number.isNaN(publicarEn.getTime())) return setError('Fecha u hora no válidas.')
    if (!supabase) return setError('Publicar en Instagram necesita la base de datos conectada.')

    try {
      const { data: orgId, error: errOrg } = await supabase.rpc('mi_organizacion_id')
      if (errOrg || !orgId) throw new Error('No se encontró tu organización')
      // La política del bucket exige que el primer segmento sea la organización.
      const prefijo = `${orgId}/${clienteId}/`
      const subidos = []
      for (let i = 0; i < archivos.length; i++) {
        setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`)
        subidos.push(await subirArchivo(archivos[i], prefijo))
      }
      let portadaRuta = null
      if (tipo === 'reel' && portada) {
        setProgreso('Subiendo la portada…')
        portadaRuta = (await subirArchivo(portada, prefijo)).ruta
      }
      const portadaNombre = portadaRuta ? portada.name.slice(0, 255) : null
      setProgreso('Programando…')
      await programarPublicacionInstagram(clienteId, post.id, {
        tipo, archivos: subidos, portadaRuta, portadaNombre, caption, compartirEnFeed: enFeed, publicarEn: publicarEn.toISOString(),
        ...(tipo === 'reel' ? { esTrial, trialGraduacion: graduacion } : {}),
      })
      setAbierto(false)
      setArchivos([])
      setPortada(null)
      recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setProgreso(null)
    }
  }

  const cancelar = async () => {
    setCancelando(true)
    setError(null)
    try {
      await cancelarPublicacionInstagram(clienteId, post.id)
      recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelando(false)
    }
  }

  const titulo = <div style={etiqueta}>Publicar en Instagram</div>
  if (!actual) return <div>{titulo}<p style={nota}>Comprobando Instagram…</p></div>
  if (actual.error) return <div>{titulo}<p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>{actual.error.message}</p></div>

  const { conectado, permisosOk } = actual.data
  if (!conectado || !permisosOk) {
    return (
      <div>
        {titulo}
        <p style={{ ...nota, marginBottom: 8 }}>
          {conectado
            ? 'Vuelve a conectar Instagram para poder publicar desde Aify (hacen falta permisos nuevos).'
            : 'Conecta el Instagram del cliente en el paso Seguimiento para publicar desde aquí.'}
        </p>
        {conectado && <button type="button" style={boton} onClick={() => conectarInstagram(clienteId).catch(err => setError(err.message))}>Volver a conectar</button>}
        {error && <p style={{ ...caja('rgba(255,59,48,0.08)', '#C4271D'), marginTop: 8 }}>{error}</p>}
      </div>
    )
  }

  const bloqueado = pub && ['procesando', 'publicado'].includes(pub.estado)
  const ocupado = Boolean(progreso)

  return (
    <div>
      {titulo}
      {pub && <Estado pub={pub} onCancelar={cancelar} cancelando={cancelando} />}
      {pub && pub.estado !== 'cancelado' && <Resumen pub={pub} />}
      {error && <p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>{error}</p>}

      {!bloqueado && !abierto && (
        <button type="button" style={boton} onClick={() => setAbierto(true)}>
          <Send size={12} /> {pub?.estado === 'programado' ? 'Cambiar programación' : 'Programar publicación'}
        </button>
      )}

      {!bloqueado && abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid #E5E5EA' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <button key={t.id} type="button" onClick={() => { setTipo(t.id); setArchivos([]) }}
                style={{ ...boton, padding: '5px 10px', ...(tipo === t.id ? { background: '#1D1D1F', color: '#fff', borderColor: '#1D1D1F' } : {}) }}>
                {t.texto}
              </button>
            ))}
          </div>

          <div>
            <div style={etiqueta}>{tipo === 'carrusel' ? 'Archivos (2 a 10, en orden)' : 'Archivo'}</div>
            {pub?.estado === 'programado' && (
              <p style={{ ...nota, marginBottom: 4 }}>Para cambiar la programación hay que volver a elegir el archivo (arriba ves cuál está programado ahora).</p>
            )}
            <input type="file" multiple={tipo === 'carrusel'}
              accept={tipo === 'reel' ? 'video/mp4,video/quicktime' : tipo === 'post' ? 'image/*' : 'image/*,video/mp4,video/quicktime'}
              onChange={e => { setArchivos(Array.from(e.target.files || []).slice(0, 10)); setError(null) }}
              style={{ fontSize: 12 }} />
            {archivos.length > 0 && (
              <p style={{ ...nota, marginTop: 4 }}>
                {archivos.map(f => f.name).join(', ')}
              </p>
            )}
            {archivos.some(f => esVideo(f) && f.size > AVISO_TAMAÑO_VIDEO) && (
              <p style={{ ...nota, color: '#A05A00', marginTop: 4 }}>
                El vídeo pesa más de 50 MB, el límite por archivo del plan gratuito de Supabase. Si falla la subida, comprímelo o sube el límite en Supabase.
              </p>
            )}
          </div>

          {tipo === 'reel' && (
            <>
              <div>
                <div style={etiqueta}>Portada <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span></div>
                <input type="file" accept="image/*" onChange={e => setPortada(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1D1D1F' }}>
                <input type="checkbox" checked={enFeed} onChange={e => setEnFeed(e.target.checked)} /> Mostrar también en el feed
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1D1D1F' }}>
                <input type="checkbox" checked={esTrial} onChange={e => setEsTrial(e.target.checked)} /> Publicar como Trial Reel (solo para no seguidores)
              </label>
              {esTrial && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1D1D1F', flexWrap: 'wrap' }}>
                  Pasar a los seguidores:
                  <select value={graduacion} onChange={e => setGraduacion(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6 }}>
                    <option value="MANUAL">Lo decido yo en Instagram</option>
                    <option value="SS_PERFORMANCE">Automático si funciona bien</option>
                  </select>
                </label>
              )}
            </>
          )}

          {tipo !== 'historia' && (
            <div>
              <div style={{ ...etiqueta, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>Texto</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{caption.length}/{MAX_CAPTION}</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 6 }}>
                <GeneradorTexto clienteId={clienteId} cliente={cliente} post={post} tipo={tipo}
                  onElegir={texto => setCaption(texto.slice(0, MAX_CAPTION))} />
              </div>
              <textarea rows={4} value={caption} maxLength={MAX_CAPTION} onChange={e => setCaption(e.target.value)} style={{ ...campo, resize: 'vertical' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={etiqueta}>Día</div>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campo} />
            </div>
            <div>
              <div style={etiqueta}>Hora</div>
              <input type="time" value={hora} onChange={e => { setHora(e.target.value); setHoraTocada(true); setHoraElegida(true) }} style={campo} />
            </div>
          </div>
          {fecha && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {FRANJAS.map(f => {
                  const s = sugerida?.[f.id]
                  const activa = franja === f.id
                  return (
                    <button key={f.id} type="button" onClick={() => elegirFranja(f.id)}
                      style={{ ...boton, flex: 1, justifyContent: 'center', padding: '6px 8px', ...(activa ? { background: '#1D1D1F', color: '#fff', borderColor: '#1D1D1F' } : {}) }}>
                      {f.texto}
                      {s && <span style={{ fontWeight: 700, opacity: activa ? 1 : 0.8 }}>· {s.hora}</span>}
                      {s && sugerida.mejor === f.id && <Sparkles size={11} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, lineHeight: 1.45, padding: '7px 9px', borderRadius: 8, background: 'rgba(29,95,224,0.06)', color: '#1D5FE0' }}>
                <Sparkles size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                {!sugerida ? (
                  <span>Buscando las mejores horas para publicar…</span>
                ) : sugerida.error ? (
                  <span style={{ color: '#86868B' }}>No se pudo sugerir una hora ahora mismo.</span>
                ) : sugerida[franja] ? (
                  <span style={{ flex: 1 }}>
                    <strong>Mejor hora de {franja === 'tarde' ? 'tarde' : 'mañana'}: {sugerida[franja].hora}</strong>
                    {sugerida[franja].motivo ? ` — ${sugerida[franja].motivo}` : ''}
                    {sugerida.mejor === franja && ' La IA la recomienda para este día.'}
                    {hora !== sugerida[franja].hora && (
                      <button type="button" onClick={() => { setHora(sugerida[franja].hora); setHoraTocada(true); setHoraElegida(true) }}
                        style={{ marginLeft: 6, background: 'none', border: 'none', padding: 0, color: '#1D5FE0', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        Usar
                      </button>
                    )}
                  </span>
                ) : (
                  <span style={{ color: '#86868B' }}>La IA no ha encontrado una buena hora de {franja === 'tarde' ? 'tarde' : 'mañana'} para este día.</span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" style={{ ...botonPrincipal, opacity: ocupado ? 0.7 : 1 }} onClick={programar} disabled={ocupado}>
              <Send size={12} /> {progreso || 'Programar'}
            </button>
            <button type="button" style={boton} onClick={() => { setAbierto(false); setError(null) }} disabled={ocupado}>Cerrar</button>
          </div>
          <p style={nota}>Instagram no permite música de su biblioteca ni stickers en lo que se publica desde fuera de la app. Si la hora ya pasó, se publica en el próximo minuto.</p>
        </div>
      )}
    </div>
  )
}
