import { useEffect, useRef, useState } from 'react'
import { Send, ExternalLink, X } from 'lucide-react'
import { supabase } from '../services/supabase'
import { BUCKET_PUBLICACIONES } from '../services/instagram'
import {
  getPublicacionesTikTok, getCreadorTikTok, programarPublicacionTikTok, cancelarPublicacionTikTok, conectarTikTok,
  NOMBRES_PRIVACIDAD,
} from '../services/tiktok'
import { formatoDe } from '../utils/formato'

// "Publicar en TikTok" dentro del panel de un post del calendario. Como
// PublicarInstagram: sube los archivos al bucket "publicaciones" y el proceso
// de server.js publica a la hora. El formulario sigue las normas de TikTok
// para apps que publican (Content Sharing Guidelines): se ve la cuenta que
// publica, la privacidad no viene elegida, las interacciones salen
// desmarcadas, el contenido comercial apagado y el consentimiento a la vista.

const TERMINOS_MUSICA = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'
const TERMINOS_MARCA = 'https://www.tiktok.com/legal/page/global/bc-policy/en'
const MAX_TITULO_VIDEO = 2200
const MAX_TITULO_FOTOS = 90
const MAX_DESCRIPCION_FOTOS = 4000
const MAX_FOTOS = 35
const AVISO_TAMAÑO_VIDEO = 50 * 1024 * 1024 // límite por archivo del plan gratuito de Supabase

const etiqueta = { fontSize: 10, fontWeight: 600, color: '#86868B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }
const campo = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F9F9FB', color: '#1D1D1F' }
const boton = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#F9F9FB', color: '#1D1D1F', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }
const botonPrincipal = { ...boton, border: 'none', background: '#1D1D1F', color: '#fff', fontWeight: 600 }
const nota = { fontSize: 11, color: '#86868B', lineHeight: 1.45, margin: 0 }
const caja = (fondo, color) => ({ fontSize: 12, lineHeight: 1.45, padding: '8px 10px', borderRadius: 8, background: fondo, color, margin: '0 0 8px' })
const casilla = (desactivada) => ({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: desactivada ? '#AEAEB2' : '#1D1D1F', cursor: desactivada ? 'not-allowed' : 'pointer' })
const enlace = { color: '#1D5FE0', fontWeight: 600 }

const TIPOS = [
  { id: 'video', texto: 'Vídeo' },
  { id: 'fotos', texto: 'Fotos' },
]

// Mientras TikTok procesa (status/fetch)
const PASOS_TIKTOK = {
  PROCESSING_DOWNLOAD: 'TikTok está descargando el archivo…',
  PROCESSING_UPLOAD: 'TikTok está procesando la publicación…',
}

function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const textoDelPost = (post) => [post.copy, post.hashtags].filter(Boolean).join('\n\n')

const segundosTexto = (s) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${Math.round(s % 60)} s` : ''}` : `${Math.round(s)} s`)

// TikTok acepta fotos JPEG/WebP de hasta 1080p: se redibujan en un canvas con
// el lado corto como mucho a 1080 (y el largo a 1920) y se exportan en JPEG.
async function aJpegTikTok(file) {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, 1080 / Math.min(bitmap.width, bitmap.height), 1920 / Math.max(bitmap.width, bitmap.height))
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
  const blob = video ? file : await aJpegTikTok(file)
  const ext = video ? (file.type === 'video/quicktime' ? 'mov' : 'mp4') : 'jpg'
  const ruta = `${prefijo}${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_PUBLICACIONES).upload(ruta, blob, {
    contentType: video ? file.type : 'image/jpeg', upsert: false,
  })
  if (error) throw new Error(`No se pudo subir ${file.name}: ${error.message}`)
  return { ruta, tipo: video ? 'video' : 'imagen', nombre: file.name.slice(0, 255), bytes: file.size }
}

function Estado({ pub, onCancelar, cancelando }) {
  if (pub.estado === 'programado') {
    return (
      <div style={caja('rgba(0,122,255,0.08)', '#0A58CA')}>
        Se publicará en TikTok el {fechaHora(pub.publicar_en)}.
        {pub.error && <div style={{ marginTop: 4 }}>{pub.error}</div>}
        <div style={{ marginTop: 6 }}>
          <button type="button" style={boton} onClick={onCancelar} disabled={cancelando}><X size={12} /> {cancelando ? 'Cancelando…' : 'Cancelar'}</button>
        </div>
      </div>
    )
  }
  if (pub.estado === 'procesando') {
    return (
      <p style={caja('rgba(255,159,10,0.10)', '#A05A00')}>
        {PASOS_TIKTOK[pub.estado_tiktok] || 'Enviando a TikTok…'} Puede tardar unos minutos.
      </p>
    )
  }
  if (pub.estado === 'publicado') {
    return (
      <p style={caja('rgba(48,164,108,0.10)', '#1F7A4D')}>
        Publicado en TikTok{pub.publicado_en ? ` el ${fechaHora(pub.publicado_en)}` : ''}
        {pub.privacidad === 'SELF_ONLY' ? ' (privado: solo lo ve la cuenta)' : ''}.{' '}
        {pub.enlace ? (
          <a href={pub.enlace} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            Ver en TikTok <ExternalLink size={11} />
          </a>
        ) : 'Puede tardar unos minutos en aparecer en el perfil.'}
      </p>
    )
  }
  if (pub.estado === 'error') return <p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>No se pudo publicar en TikTok: {pub.error || 'error desconocido'}. Puedes volver a programarlo.</p>
  return null
}

function Resumen({ pub }) {
  const fila = (nombre, valor) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ width: 86, flexShrink: 0, color: '#86868B' }}>{nombre}</span>
      <span style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>{valor}</span>
    </div>
  )
  const video = pub.tipo === 'video'
  const interacciones = [
    pub.permitir_comentarios && 'comentarios',
    video && pub.permitir_duo && 'dúo',
    video && pub.permitir_stitch && 'stitch',
  ].filter(Boolean)
  const comercial = !pub.contenido_comercial ? 'No'
    : pub.contenido_de_marca ? 'Colaboración pagada' : 'Contenido promocional (tu marca)'
  const archivos = pub.archivos || []
  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, color: '#1D1D1F', padding: '9px 10px', borderRadius: 8, border: '1px solid #E5E5EA', margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...etiqueta, marginBottom: 2 }}>{pub.estado === 'publicado' ? 'Lo que se publicó' : 'Lo que se va a publicar'}</div>
      {fila('Formato', video ? 'Vídeo' : `Fotos (${archivos.length})`)}
      {fila(archivos.length > 1 ? 'Archivos' : 'Archivo', archivos.map(a => a.nombre || (a.tipo === 'video' ? 'Vídeo' : 'Imagen')).join(', ')
        + (pub.archivos_borrados ? ' · borrado de Aify al publicarse' : ''))}
      {fila(video ? 'Texto' : 'Título', pub.titulo || <span style={{ color: '#86868B' }}>Sin texto</span>)}
      {!video && pub.descripcion && fila('Descripción', <span style={{ whiteSpace: 'pre-wrap' }}>{pub.descripcion.length > 140 ? `${pub.descripcion.slice(0, 140)}…` : pub.descripcion}</span>)}
      {fila('Quién lo ve', NOMBRES_PRIVACIDAD[pub.privacidad] || pub.privacidad)}
      {fila('Permite', interacciones.length ? interacciones.join(', ') : 'nada (sin comentarios ni remezclas)')}
      {fila('Comercial', comercial)}
      {video && pub.es_ia && fila('IA', 'Marcado como contenido generado con IA')}
      {fila('Cuándo', fechaHora(pub.estado === 'publicado' && pub.publicado_en ? pub.publicado_en : pub.publicar_en))}
    </div>
  )
}

// onCambiar({ fecha?, hora? }): solo llega cuando el post es solo de TikTok
// (si también es de Instagram, la fecha la mueve el formulario de Instagram).
export default function PublicarTikTok({ clienteId, post, abiertoInicial = false, onCambiar = null }) {
  const [recarga, setRecarga] = useState(0)
  const clave = `${clienteId}|${post.id}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [vecesAbierto, setVecesAbierto] = useState(0) // creator_info se pide cada vez que se abre
  const [creador, setCreador] = useState(null) // { clave, data?, error? }
  const [tipo, setTipo] = useState(() => (formatoDe(post) === 'carrusel' ? 'fotos' : 'video'))
  const [archivos, setArchivos] = useState([]) // [{ file, url }]
  const [duracion, setDuracion] = useState(null) // segundos del vídeo elegido
  const [portadaMs, setPortadaMs] = useState(null)
  const [portadaIndice, setPortadaIndice] = useState(0)
  // Vídeo: el copy va en el texto. Fotos: título corto y el copy en la descripción.
  const [titulo, setTitulo] = useState(() => (formatoDe(post) === 'carrusel'
    ? (post.titulo || '').slice(0, MAX_TITULO_FOTOS)
    : textoDelPost(post).slice(0, MAX_TITULO_VIDEO)))
  const [descripcion, setDescripcion] = useState(() => (formatoDe(post) === 'carrusel' ? textoDelPost(post).slice(0, MAX_DESCRIPCION_FOTOS) : ''))
  const [privacidad, setPrivacidad] = useState('') // TikTok: sin valor por defecto
  const [comentarios, setComentarios] = useState(false)
  const [duo, setDuo] = useState(false)
  const [stitch, setStitch] = useState(false)
  const [comercial, setComercial] = useState(false)
  const [marcaPropia, setMarcaPropia] = useState(false)
  const [deMarca, setDeMarca] = useState(false)
  const [esIa, setEsIa] = useState(false)
  const [musicaAuto, setMusicaAuto] = useState(false)
  const [fecha, setFecha] = useState(post.fecha || '')
  const [hora, setHora] = useState(post.hora ? post.hora.slice(0, 5) : '12:00')
  const [fechaDelPost, setFechaDelPost] = useState(post.fecha)
  if (post.fecha !== fechaDelPost) {
    setFechaDelPost(post.fecha)
    setFecha(post.fecha || '')
  }
  const [fechaTocada, setFechaTocada] = useState(false)
  const [progreso, setProgreso] = useState(null)
  const [error, setError] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const videoRef = useRef(null)
  const urlsRef = useRef([])

  // Las vistas previas son object URLs: se liberan al desmontar.
  useEffect(() => () => { for (const u of urlsRef.current) URL.revokeObjectURL(u) }, [])

  // Día y hora elegidos aquí mueven el post en el calendario (como Instagram).
  const onCambiarRef = useRef(onCambiar)
  useEffect(() => { onCambiarRef.current = onCambiar })
  useEffect(() => {
    if (!fechaTocada || !onCambiarRef.current || !fecha) return
    const cambios = {}
    if (fecha !== post.fecha) cambios.fecha = fecha
    if (hora && hora !== (post.hora || '').slice(0, 5)) cambios.hora = hora
    if (!Object.keys(cambios).length) return
    const t = setTimeout(() => onCambiarRef.current?.(cambios), 600)
    return () => clearTimeout(t)
  }, [fecha, hora, fechaTocada, post.fecha, post.hora])

  useEffect(() => {
    let activo = true
    getPublicacionesTikTok(clienteId)
      .then(data => { if (activo) setEstado({ clave, data }) })
      .catch(err => { if (activo) setEstado({ clave, error: err }) })
    return () => { activo = false }
  }, [clienteId, clave])

  const actual = estado?.clave === clave ? estado : null
  const listo = Boolean(actual?.data?.conectado && actual.data.permisosOk)
  const claveCreador = `${clienteId}|${vecesAbierto}`
  useEffect(() => {
    if (!abierto || !listo) return
    let activo = true
    getCreadorTikTok(clienteId)
      .then(data => { if (activo) setCreador({ clave: claveCreador, data }) })
      .catch(err => { if (activo) setCreador({ clave: claveCreador, error: err }) })
    return () => { activo = false }
  }, [abierto, listo, clienteId, claveCreador])
  const creadorActual = creador?.clave === claveCreador ? creador : null
  const datosCreador = creadorActual?.data || null

  const pub = actual?.data?.publicaciones?.find(p => p.post_id === post.id) || null
  // Al cambiar una programación, el formulario parte de lo ya elegido.
  const versionPub = pub && pub.estado !== 'cancelado' ? `${pub.id}|${pub.actualizado_en}` : null
  const [pubCargada, setPubCargada] = useState(null)
  if (versionPub && versionPub !== pubCargada) {
    setPubCargada(versionPub)
    setTipo(pub.tipo)
    setTitulo(pub.titulo || '')
    setDescripcion(pub.descripcion || '')
    setPrivacidad(pub.privacidad || '')
    setComentarios(Boolean(pub.permitir_comentarios))
    setDuo(Boolean(pub.permitir_duo))
    setStitch(Boolean(pub.permitir_stitch))
    setComercial(Boolean(pub.contenido_comercial))
    setMarcaPropia(Boolean(pub.marca_propia))
    setDeMarca(Boolean(pub.contenido_de_marca))
    setEsIa(Boolean(pub.es_ia))
    setMusicaAuto(Boolean(pub.musica_auto))
  }
  const recargar = () => setRecarga(r => r + 1)

  // Mientras se publica, se vuelve a mirar cada 15 s.
  useEffect(() => {
    if (pub?.estado !== 'procesando') return
    const id = setTimeout(() => setRecarga(r => r + 1), 15000)
    return () => clearTimeout(id)
  }, [pub?.estado, recarga])

  const abrir = () => { setAbierto(true); setVecesAbierto(v => v + 1); setError(null) }

  const elegirArchivos = (lista) => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    const elegidos = lista.slice(0, tipo === 'fotos' ? MAX_FOTOS : 1).map(file => ({ file, url: URL.createObjectURL(file) }))
    urlsRef.current = elegidos.map(a => a.url)
    setArchivos(elegidos)
    setDuracion(null)
    setPortadaMs(null)
    setPortadaIndice(0)
    setError(null)
  }

  const cambiarTipo = (t) => {
    if (t === tipo) return
    setTipo(t)
    elegirArchivos([])
    if (t === 'fotos') setTitulo(v => v.slice(0, MAX_TITULO_FOTOS))
  }

  const cambiarPortada = (ms) => {
    setPortadaMs(ms)
    if (videoRef.current) videoRef.current.currentTime = ms / 1000
  }

  const cambiarDeMarca = (valor) => {
    setDeMarca(valor)
    // El contenido de marca no puede ser privado: si estaba en «Solo yo», hay que elegir otra.
    if (valor && privacidad === 'SELF_ONLY') setPrivacidad('')
  }

  const video = tipo === 'video'
  const soloPrivado = Boolean(datosCreador?.soloPrivado)
  const duracionMax = datosCreador?.duracionMaxSeg || null
  const demasiadoLargo = video && duracion != null && duracionMax != null && duracion > duracionMax
  const maxTitulo = video ? MAX_TITULO_VIDEO : MAX_TITULO_FOTOS

  // Por qué no se puede programar todavía (se enseña junto al botón).
  const motivoBloqueo = !datosCreador ? 'Esperando los datos de la cuenta de TikTok.'
    : archivos.length === 0 ? (video ? 'Elige el vídeo.' : 'Elige las fotos.')
      : video && duracion == null ? 'Leyendo la duración del vídeo…'
        : demasiadoLargo ? `El vídeo dura ${segundosTexto(duracion)} y esta cuenta permite como mucho ${segundosTexto(duracionMax)}.`
          : !privacidad ? 'Elige quién puede verlo.'
            : comercial && !marcaPropia && !deMarca ? 'Indica si el contenido promociona tu marca, la de un tercero o ambas.'
              : comercial && deMarca && privacidad === 'SELF_ONLY' ? 'El contenido de marca no puede ser «Solo yo».'
                : !fecha || !hora ? 'Pon la fecha y la hora de publicación.'
                  : null

  const programar = async () => {
    setError(null)
    if (motivoBloqueo) return setError(motivoBloqueo)
    const publicarEn = new Date(`${fecha}T${hora}:00`)
    if (Number.isNaN(publicarEn.getTime())) return setError('Fecha u hora no válidas.')
    if (!supabase) return setError('Publicar en TikTok necesita la base de datos conectada.')
    try {
      const { data: orgId, error: errOrg } = await supabase.rpc('mi_organizacion_id')
      if (errOrg || !orgId) throw new Error('No se encontró tu organización')
      const prefijo = `${orgId}/${clienteId}/`
      const subidos = []
      for (let i = 0; i < archivos.length; i++) {
        setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`)
        subidos.push(await subirArchivo(archivos[i].file, prefijo))
      }
      setProgreso('Programando…')
      await programarPublicacionTikTok(clienteId, post.id, {
        tipo,
        archivos: subidos,
        titulo: titulo.slice(0, maxTitulo),
        descripcion: video ? undefined : descripcion,
        privacidad,
        // Lo que el creador tiene desactivado en TikTok va siempre apagado.
        permitirComentarios: comentarios && !datosCreador.comentariosDesactivados,
        permitirDuo: video && duo && !datosCreador.duoDesactivado,
        permitirStitch: video && stitch && !datosCreador.stitchDesactivado,
        contenidoComercial: comercial,
        marcaPropia: comercial && marcaPropia,
        contenidoDeMarca: comercial && deMarca,
        esIa: video && esIa,
        musicaAuto: !video && musicaAuto,
        ...(video ? (portadaMs != null ? { portadaMs } : {}) : { portadaIndice }),
        consentimiento: true,
        publicarEn: publicarEn.toISOString(),
      })
      setAbierto(false)
      elegirArchivos([])
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
      await cancelarPublicacionTikTok(clienteId, post.id)
      recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelando(false)
    }
  }

  const tituloBloque = <div style={etiqueta}>Publicar en TikTok</div>
  if (!actual) return <div>{tituloBloque}<p style={nota}>Comprobando TikTok…</p></div>
  if (actual.error) return <div>{tituloBloque}<p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>{actual.error.message}</p></div>

  const { configurado, conectado, permisosOk } = actual.data
  if (!configurado) return <div>{tituloBloque}<p style={nota}>La conexión con TikTok todavía no está configurada.</p></div>
  if (!conectado || !permisosOk) {
    return (
      <div>
        {tituloBloque}
        <p style={{ ...nota, marginBottom: 8 }}>
          {conectado
            ? 'Vuelve a conectar TikTok aceptando el permiso de publicar.'
            : 'Conecta el TikTok del cliente en el paso Seguimiento para publicar desde aquí.'}
        </p>
        {conectado && <button type="button" style={boton} onClick={() => conectarTikTok(clienteId).catch(err => setError(err.message))}>Volver a conectar</button>}
        {error && <p style={{ ...caja('rgba(255,59,48,0.08)', '#C4271D'), marginTop: 8 }}>{error}</p>}
      </div>
    )
  }

  const bloqueado = pub && ['procesando', 'publicado'].includes(pub.estado)
  const ocupado = Boolean(progreso)
  const interaccion = (texto, valor, cambiar, desactivada) => (
    <label style={casilla(desactivada)} title={desactivada ? 'La cuenta lo tiene desactivado en TikTok' : undefined}>
      <input type="checkbox" checked={valor && !desactivada} disabled={desactivada} onChange={e => cambiar(e.target.checked)} /> {texto}
      {desactivada && <span style={{ fontSize: 11 }}>(desactivado en la cuenta)</span>}
    </label>
  )

  return (
    <div>
      {tituloBloque}
      {pub && <Estado pub={pub} onCancelar={cancelar} cancelando={cancelando} />}
      {pub && pub.estado !== 'cancelado' && <Resumen pub={pub} />}
      {error && <p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>{error}</p>}

      {!bloqueado && !abierto && (
        <button type="button" style={boton} onClick={abrir}>
          <Send size={12} /> {pub?.estado === 'programado' ? 'Cambiar programación en TikTok' : 'Programar en TikTok'}
        </button>
      )}

      {!bloqueado && abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid #E5E5EA' }}>
          {/* Cuenta que publica: TikTok exige enseñarla */}
          {!creadorActual ? (
            <p style={nota}>Comprobando la cuenta de TikTok…</p>
          ) : creadorActual.error ? (
            <div>
              <p style={caja('rgba(255,59,48,0.08)', '#C4271D')}>{creadorActual.error.message}</p>
              {creadorActual.error.codigo === 'reconectar'
                ? <button type="button" style={boton} onClick={() => conectarTikTok(clienteId).catch(err => setError(err.message))}>Volver a conectar</button>
                : <button type="button" style={boton} onClick={() => setVecesAbierto(v => v + 1)}>Reintentar</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {datosCreador.avatar
                ? <img src={datosCreador.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA' }} />}
              <div style={{ fontSize: 12, color: '#1D1D1F' }}>
                Se publica en <strong>{datosCreador.nombre || datosCreador.usuario || 'la cuenta conectada'}</strong>
                {datosCreador.usuario && <span style={{ color: '#86868B' }}> · @{datosCreador.usuario}</span>}
              </div>
            </div>
          )}

          {soloPrivado && (
            <p style={caja('rgba(255,159,10,0.10)', '#A05A00')}>
              Hasta que TikTok apruebe la auditoría de Aify, todo se publica como privado («Solo yo») y solo en cuentas privadas.
            </p>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            {TIPOS.map(t => (
              <button key={t.id} type="button" onClick={() => cambiarTipo(t.id)}
                style={{ ...boton, padding: '5px 10px', ...(tipo === t.id ? { background: '#1D1D1F', color: '#fff', borderColor: '#1D1D1F' } : {}) }}>
                {t.texto}
              </button>
            ))}
          </div>

          <div>
            <div style={etiqueta}>{video ? 'Vídeo' : `Fotos (1 a ${MAX_FOTOS}, en orden)`}</div>
            {pub?.estado === 'programado' && (
              <p style={{ ...nota, marginBottom: 4 }}>Para cambiar la programación hay que volver a elegir {video ? 'el vídeo' : 'las fotos'}.</p>
            )}
            <input type="file" multiple={!video} accept={video ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp'}
              onChange={e => elegirArchivos(Array.from(e.target.files || []))} style={{ fontSize: 12 }} />
            {archivos.some(a => esVideo(a.file) && a.file.size > AVISO_TAMAÑO_VIDEO) && (
              <p style={{ ...nota, color: '#A05A00', marginTop: 4 }}>
                El vídeo pesa más de 50 MB, el límite por archivo del plan gratuito de Supabase. Si falla la subida, comprímelo.
              </p>
            )}
          </div>

          {/* Vista previa (y portada) */}
          {video && archivos[0] && (
            <div>
              <div style={etiqueta}>Vista previa</div>
              <video ref={videoRef} src={archivos[0].url} controls muted playsInline preload="metadata"
                onLoadedMetadata={e => setDuracion(e.currentTarget.duration)}
                style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }} />
              {duracion != null && (
                <>
                  <p style={{ ...nota, marginTop: 4, ...(demasiadoLargo ? { color: '#C4271D' } : {}) }}>
                    Dura {segundosTexto(duracion)}{duracionMax ? ` · esta cuenta permite hasta ${segundosTexto(duracionMax)}` : ''}.
                  </p>
                  <label style={{ display: 'block', marginTop: 6 }}>
                    <span style={etiqueta}>Portada: segundo {((portadaMs || 0) / 1000).toFixed(1).replace('.', ',')}</span>
                    <input type="range" min={0} max={Math.floor(duracion * 1000)} step={100} value={portadaMs || 0}
                      onChange={e => cambiarPortada(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                </>
              )}
            </div>
          )}
          {!video && archivos.length > 0 && (
            <div>
              <div style={etiqueta}>Vista previa · toca una foto para usarla de portada</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
                {archivos.map((a, i) => (
                  <button key={a.url} type="button" onClick={() => setPortadaIndice(i)} title={i === portadaIndice ? 'Portada' : 'Usar de portada'}
                    style={{ padding: 0, border: `2px solid ${i === portadaIndice ? '#1D5FE0' : 'transparent'}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '3 / 4' }}>
                    <img src={a.url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ ...etiqueta, display: 'flex', justifyContent: 'space-between' }}>
              <span>{video ? 'Texto' : 'Título'}</span><span>{titulo.length}/{maxTitulo}</span>
            </div>
            {video
              ? <textarea rows={4} value={titulo} maxLength={maxTitulo} onChange={e => setTitulo(e.target.value)} style={{ ...campo, resize: 'vertical' }} />
              : <input value={titulo} maxLength={maxTitulo} onChange={e => setTitulo(e.target.value)} style={campo} />}
          </div>
          {!video && (
            <div>
              <div style={{ ...etiqueta, display: 'flex', justifyContent: 'space-between' }}>
                <span>Descripción</span><span>{descripcion.length}/{MAX_DESCRIPCION_FOTOS}</span>
              </div>
              <textarea rows={4} value={descripcion} maxLength={MAX_DESCRIPCION_FOTOS} onChange={e => setDescripcion(e.target.value)} style={{ ...campo, resize: 'vertical' }} />
            </div>
          )}

          {datosCreador && (
            <>
              <div>
                <div style={etiqueta}>Quién puede verlo</div>
                <select value={privacidad} onChange={e => setPrivacidad(e.target.value)} style={campo}>
                  <option value="" disabled>Elige una opción</option>
                  {datosCreador.opcionesPrivacidad.map(op => {
                    const privadaConMarca = op === 'SELF_ONLY' && comercial && deMarca
                    const pendienteAuditoria = soloPrivado && op !== 'SELF_ONLY'
                    return (
                      <option key={op} value={op} disabled={privadaConMarca || pendienteAuditoria}>
                        {NOMBRES_PRIVACIDAD[op] || op}
                        {privadaConMarca ? ' (el contenido de marca no puede ser privado)' : pendienteAuditoria ? ' (tras la auditoría de TikTok)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <div style={etiqueta}>Permitir a los usuarios</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {interaccion('Comentar', comentarios, setComentarios, datosCreador.comentariosDesactivados)}
                  {video && interaccion('Hacer dúo', duo, setDuo, datosCreador.duoDesactivado)}
                  {video && interaccion('Hacer stitch', stitch, setStitch, datosCreador.stitchDesactivado)}
                </div>
              </div>

              <div>
                <label style={{ ...casilla(false), fontWeight: 600 }}>
                  <input type="checkbox" checked={comercial} onChange={e => setComercial(e.target.checked)} /> Contenido comercial
                </label>
                <p style={{ ...nota, marginTop: 2 }}>Actívalo si esta publicación promociona una marca, un producto o un servicio a cambio de algo.</p>
                {comercial && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, paddingLeft: 10 }}>
                    <label style={casilla(false)}>
                      <input type="checkbox" checked={marcaPropia} onChange={e => setMarcaPropia(e.target.checked)} /> Tu marca
                    </label>
                    <p style={{ ...nota, paddingLeft: 20 }}>Promocionas tu propio negocio o el del cliente.</p>
                    <label style={casilla(soloPrivado)} title={soloPrivado ? 'El contenido de marca no puede ser privado' : undefined}>
                      <input type="checkbox" checked={deMarca && !soloPrivado} disabled={soloPrivado} onChange={e => cambiarDeMarca(e.target.checked)} /> Contenido de marca
                    </label>
                    <p style={{ ...nota, paddingLeft: 20 }}>
                      Promocionas a otra marca o a un tercero.{soloPrivado ? ' Disponible tras la auditoría de TikTok (no puede ser privado).' : ''}
                    </p>
                    {!marcaPropia && !deMarca && (
                      <p style={{ ...nota, color: '#A05A00' }}>Elige al menos una opción para poder programarlo.</p>
                    )}
                    {(marcaPropia || deMarca) && (
                      <p style={caja('rgba(0,122,255,0.08)', '#0A58CA')}>
                        La publicación se etiquetará como «{deMarca ? 'Colaboración pagada' : 'Contenido promocional'}».
                      </p>
                    )}
                  </div>
                )}
              </div>

              {video && (
                <label style={casilla(false)}>
                  <input type="checkbox" checked={esIa} onChange={e => setEsIa(e.target.checked)} /> Contenido generado con IA
                </label>
              )}
              {!video && (
                <label style={casilla(false)}>
                  <input type="checkbox" checked={musicaAuto} onChange={e => setMusicaAuto(e.target.checked)} /> Añadir música recomendada por TikTok
                </label>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={etiqueta}>Día</div>
              <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setFechaTocada(true) }} style={campo} />
            </div>
            <div>
              <div style={etiqueta}>Hora</div>
              <input type="time" value={hora} onChange={e => { setHora(e.target.value); setFechaTocada(true) }} style={campo} />
            </div>
          </div>

          <p style={nota}>
            {comercial && deMarca ? (
              <>Al programarlo, aceptas la <a href={TERMINOS_MARCA} target="_blank" rel="noreferrer" style={enlace}>Política de contenido de marca</a> y la <a href={TERMINOS_MUSICA} target="_blank" rel="noreferrer" style={enlace}>Confirmación de uso de música</a> de TikTok.</>
            ) : (
              <>Al programarlo, aceptas la <a href={TERMINOS_MUSICA} target="_blank" rel="noreferrer" style={enlace}>Confirmación de uso de música</a> de TikTok.</>
            )}
          </p>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={{ ...botonPrincipal, opacity: ocupado || motivoBloqueo ? 0.6 : 1, cursor: motivoBloqueo ? 'not-allowed' : 'pointer' }}
              onClick={programar} disabled={ocupado || Boolean(motivoBloqueo)} title={motivoBloqueo || undefined}>
              <Send size={12} /> {progreso || 'Programar en TikTok'}
            </button>
            <button type="button" style={boton} onClick={() => { setAbierto(false); setError(null) }} disabled={ocupado}>Cerrar</button>
          </div>
          {motivoBloqueo && datosCreador && <p style={nota}>{motivoBloqueo}</p>}
          <p style={nota}>A la hora elegida Aify lo manda a TikTok; puede tardar unos minutos en procesarse y aparecer en el perfil. Si la hora ya pasó, se publica en el próximo minuto.</p>
        </div>
      )}
    </div>
  )
}
