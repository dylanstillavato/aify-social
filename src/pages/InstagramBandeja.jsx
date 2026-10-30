import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  RefreshCw, Sparkles, Send, Archive, ArchiveRestore, MailOpen, ArrowLeft, ExternalLink, Zap, Paperclip,
} from 'lucide-react'
import { Skeleton } from '../components/Skeleton'
import { Aviso, Chip } from '../components/instagramUi'
import { botonPrimario, botonSecundario, textoSecundario, campoStyle } from '../components/instagramEstilos'
import {
  getBandejaDms, getConversacionDm, actualizarConversacionDm, responderConversacionDm,
  sugerirRespuestaDm, sincronizarBandejaDms,
} from '../services/instagram'

// Bandeja de DMs: los mensajes de Instagram de todos los clientes en un solo
// sitio. Llegan por webhook (server.js → procesarMensajeInstagram) y
// "Sincronizar" trae lo que falte desde la API. Desde aquí se responde (solo
// en la ventana de 24 h que marca Meta) y la IA sugiere la respuesta.

const MAX_TEXTO = 1000
const REFRESCO_LISTA_MS = 30 * 1000
const REFRESCO_HILO_MS = 15 * 1000
// La sincronización automática al abrir se hace como mucho cada 5 minutos.
const SINCRONIZAR_CADA_MS = 5 * 60 * 1000
let ultimaSincronizacion = 0

const NOMBRES_ADJUNTO = {
  image: 'Foto', video: 'Vídeo', audio: 'Audio', file: 'Archivo', share: 'Publicación compartida',
  ig_reel: 'Reel compartido', reel: 'Reel compartido', story_mention: 'Te mencionó en su historia',
  ig_story: 'Respuesta a historia', animated_image: 'GIF', sticker: 'Sticker',
}

function hora(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  const min = Math.round((Date.now() - fecha.getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  if (fecha.toDateString() === new Date().toDateString()) return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function horaMensaje(iso) {
  const fecha = new Date(iso)
  const hoy = fecha.toDateString() === new Date().toDateString()
  return hoy
    ? fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : fecha.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function nombreContacto(c) {
  return c.contacto_username ? `@${c.contacto_username}` : c.contacto_nombre || 'Usuario de Instagram'
}

function Avatar({ src, texto, size = 40 }) {
  const [fallo, setFallo] = useState(false)
  if (src && !fallo) {
    return <img src={src} alt="" width={size} height={size} onError={() => setFallo(true)}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-secondary)',
      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, textTransform: 'uppercase',
    }}>
      {(texto || '?').replace('@', '').charAt(0)}
    </div>
  )
}

function useEsMovil() {
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < 820)
  useEffect(() => {
    const alCambiar = () => setMovil(window.innerWidth < 820)
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])
  return movil
}

function FilaConversacion({ c, cliente, activa, verCliente, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '11px 14px',
      border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'inherit',
      background: activa ? 'var(--bg-secondary)' : 'transparent',
    }}>
      <Avatar src={c.contacto_foto} texto={nombreContacto(c)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: c.noLeida ? 700 : 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nombreContacto(c)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{hora(c.ultimo_mensaje_en)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.noLeida ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.ultimo_mensaje || '—'}
          </span>
          {c.noLeida && <span aria-label="Sin leer" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0A84FF', flexShrink: 0 }} />}
        </div>
        {verCliente && cliente && (
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {cliente.nombre}
          </span>
        )}
      </div>
    </button>
  )
}

function Burbuja({ m }) {
  const saliente = m.direccion === 'saliente'
  const etiqueta = saliente && (m.origen === 'automatico' ? 'Automático' : m.origen === 'aify' ? 'Desde Aify' : null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: saliente ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '75%', padding: '8px 12px', borderRadius: 16, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        background: saliente ? 'var(--text-primary)' : 'var(--bg-secondary)', color: saliente ? 'var(--bg-card)' : 'var(--text-primary)',
        borderBottomRightRadius: saliente ? 4 : 16, borderBottomLeftRadius: saliente ? 16 : 4,
      }}>
        {(m.adjuntos || []).map((a, i) => (
          a.tipo === 'image' && a.url
            ? <img key={i} src={a.url} alt="" style={{ display: 'block', maxWidth: 220, borderRadius: 10, marginBottom: m.texto ? 6 : 0 }} />
            : (
              <a key={i} href={a.url || undefined} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'inherit', opacity: 0.85, fontSize: 12, marginBottom: m.texto ? 4 : 0 }}>
                <Paperclip size={12} /> {NOMBRES_ADJUNTO[a.tipo] || 'Archivo'}
              </a>
            )
        ))}
        {m.texto}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {etiqueta === 'Automático' && <Zap size={10} />}
        {etiqueta ? `${etiqueta} · ` : ''}{horaMensaje(m.creado_en)}
      </span>
    </div>
  )
}

function Hilo({ conversacionId, cliente, onCambio, onVolver }) {
  const [estado, setEstado] = useState(null) // { id, data?, error? }
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sugiriendo, setSugiriendo] = useState(false)
  const [error, setError] = useState(null)
  const finRef = useRef(null)
  const onCambioRef = useRef(onCambio)
  useEffect(() => { onCambioRef.current = onCambio }, [onCambio])

  const cargar = useCallback(() => getConversacionDm(conversacionId)
    .then(data => setEstado({ id: conversacionId, data }))
    .catch(err => setEstado(e => (e?.id === conversacionId && e.data ? e : { id: conversacionId, error: err }))), [conversacionId])

  useEffect(() => {
    cargar().then(() => onCambioRef.current?.({ id: conversacionId, noLeida: false }))
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') cargar() }, REFRESCO_HILO_MS)
    return () => clearInterval(intervalo)
  }, [conversacionId, cargar])

  const mensajes = estado?.id === conversacionId ? estado.data?.mensajes : null
  const ultimoMid = mensajes?.[mensajes.length - 1]?.id
  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }) }, [ultimoMid])

  if (!estado || estado.id !== conversacionId) {
    return (
      <div style={{ padding: 20 }}>
        <Skeleton height={14} width="40%" style={{ marginBottom: 20 }} />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={34} width={i % 2 ? '50%' : '65%'} style={{ marginBottom: 10, marginLeft: i % 2 ? 'auto' : 0 }} />)}
      </div>
    )
  }
  if (estado.error) return <div style={{ padding: 20 }}><Aviso tono="error">{estado.error.message}</Aviso></div>

  const { conversacion } = estado.data
  const puedeResponder = conversacion.ventanaAbierta

  const enviar = async () => {
    const limpio = texto.trim()
    if (!limpio || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const { conversacion: actualizada } = await responderConversacionDm(conversacionId, limpio)
      setTexto('')
      onCambio?.(actualizada)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const sugerir = async () => {
    setSugiriendo(true)
    setError(null)
    try {
      const { texto: sugerido } = await sugerirRespuestaDm(conversacionId, texto)
      setTexto(sugerido)
    } catch (err) {
      setError(err.message)
    } finally {
      setSugiriendo(false)
    }
  }

  const cambiar = async (cambios) => {
    setError(null)
    try {
      const { conversacion: actualizada } = await actualizarConversacionDm(conversacionId, cambios)
      onCambio?.(actualizada, cambios)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver" style={{ ...botonSecundario, padding: 6 }}><ArrowLeft size={14} /></button>
        )}
        <Avatar src={conversacion.contacto_foto} texto={nombreContacto(conversacion)} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {conversacion.contacto_nombre || nombreContacto(conversacion)}
            </span>
            {conversacion.contacto_username && (
              <a href={`https://instagram.com/${conversacion.contacto_username}`} target="_blank" rel="noreferrer"
                aria-label="Ver perfil en Instagram" style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {conversacion.contacto_username && conversacion.contacto_nombre ? `@${conversacion.contacto_username} · ` : ''}
            {cliente ? `${cliente.nombre}${cliente.igUsername ? ` (@${cliente.igUsername})` : ''}` : ''}
          </span>
        </div>
        <button type="button" style={botonSecundario} onClick={() => cambiar({ leida: false })} title="Marcar como no leída">
          <MailOpen size={13} />
        </button>
        <button type="button" style={botonSecundario} onClick={() => cambiar({ archivada: !conversacion.archivada })}>
          {conversacion.archivada ? <><ArchiveRestore size={13} /> Recuperar</> : <><Archive size={13} /> Archivar</>}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {mensajes.length === 0 && <p style={{ ...textoSecundario, textAlign: 'center' }}>Sin mensajes todavía.</p>}
        {mensajes.map(m => <Burbuja key={m.id} m={m} />)}
        <div ref={finRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
        {error && <Aviso tono="error" style={{ marginBottom: 8 }}>{error}</Aviso>}
        {!conversacion.ventanaAbierta ? (
          <Aviso tono="neutro" style={{ marginBottom: 0 }}>
            Han pasado más de 24 h desde su último mensaje: Instagram no deja responder desde aquí. Contéstale desde la app de Instagram.
          </Aviso>
        ) : (
          <>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar() } }}
              maxLength={MAX_TEXTO}
              placeholder="Escribe una respuesta…"
              style={{ ...campoStyle, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" style={{ ...botonSecundario, opacity: sugiriendo ? 0.7 : 1 }} onClick={sugerir} disabled={sugiriendo || !puedeResponder}
                title={texto.trim() ? 'La IA mejora lo que has escrito' : 'La IA propone una respuesta'}>
                <Sparkles size={13} /> {sugiriendo ? 'Pensando…' : texto.trim() ? 'Mejorar con IA' : 'Sugerir con IA'}
              </button>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>⌘ + Enter</span>
              <button type="button" style={{ ...botonPrimario, opacity: enviando || !texto.trim() ? 0.6 : 1 }} onClick={enviar} disabled={enviando || !texto.trim()}>
                <Send size={13} /> {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function InstagramBandeja() {
  const navigate = useNavigate()
  const movil = useEsMovil()
  const [params, setParams] = useSearchParams()
  const seleccionada = params.get('c')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [vista, setVista] = useState('bandeja') // bandeja | no_leidas | archivadas
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [sincronizando, setSincronizando] = useState(false)
  const [avisoSync, setAvisoSync] = useState(null)
  const clave = `${filtroCliente}|${vista}`

  const cargar = useCallback(() => getBandejaDms({ clienteId: filtroCliente || undefined, archivadas: vista === 'archivadas' })
    .then(data => setEstado({ clave, data }))
    .catch(error => setEstado(e => (e?.clave === clave && e.data ? e : { clave, error }))), [filtroCliente, vista, clave])

  const sincronizar = useCallback(async ({ silencioso = false } = {}) => {
    setSincronizando(true)
    if (!silencioso) setAvisoSync(null)
    try {
      const { nuevos, errores, cuentas = [] } = await sincronizarBandejaDms(filtroCliente || undefined)
      // Meta da una lista vacía (sin error) mientras la app no ha pasado App Review.
      const vacias = cuentas.filter(c => c.conversacionesMeta === 0)
      ultimaSincronizacion = Date.now()
      if (errores.length) setAvisoSync({ tono: 'aviso', texto: `No se pudo sincronizar ${errores.map(e => e.nombre).join(', ')}: ${errores[0].error}` })
      else if (cuentas.length > 0 && vacias.length === cuentas.length) {
        setAvisoSync({
          tono: 'aviso',
          texto: `Instagram no ha devuelto ninguna conversación de ${vacias.map(c => c.nombre).join(', ')}. Mientras la app de Aify no pase la revisión de Meta (App Review), Instagram solo comparte los DMs de cuentas añadidas como testers; los de clientes reales aparecerán cuando se apruebe.`,
        })
      } else if (!silencioso) setAvisoSync({ tono: 'ok', texto: nuevos ? `${nuevos} ${nuevos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : 'Todo al día' })
      await cargar()
    } catch (err) {
      setAvisoSync({ tono: 'error', texto: err.message })
    } finally {
      setSincronizando(false)
    }
  }, [filtroCliente, cargar])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') cargar() }, REFRESCO_LISTA_MS)
    return () => clearInterval(intervalo)
  }, [cargar])

  const datos = estado?.clave === clave ? estado.data : null
  const hayConectados = datos?.clientes.some(c => c.permisosOk)
  useEffect(() => {
    if (!hayConectados || Date.now() - ultimaSincronizacion < SINCRONIZAR_CADA_MS) return
    const temporizador = setTimeout(() => {
      ultimaSincronizacion = Date.now()
      sincronizar({ silencioso: true })
    }, 0)
    return () => clearTimeout(temporizador)
  }, [hayConectados, sincronizar])

  // Cambios del hilo (leída, archivada, nuevo mensaje) sin esperar al refresco.
  const alCambiarConversacion = useCallback((actualizada, cambios) => {
    setEstado(e => {
      if (!e?.data) return e
      const antes = e.data.conversaciones.find(c => c.id === actualizada.id)
      let conversaciones = e.data.conversaciones.map(c => (c.id === actualizada.id ? { ...c, ...actualizada } : c))
      if (cambios?.archivada !== undefined) conversaciones = conversaciones.filter(c => c.id !== actualizada.id)
      // El contador del cliente baja o sube al momento, sin esperar al refresco.
      const delta = antes && actualizada.noLeida !== undefined ? Number(actualizada.noLeida) - Number(antes.noLeida) : 0
      const clientes = delta === 0 ? e.data.clientes : e.data.clientes.map(c => (
        c.id === antes.cliente_id ? { ...c, noLeidas: Math.max(0, c.noLeidas + delta) } : c
      ))
      return { ...e, data: { ...e.data, conversaciones, clientes } }
    })
    if (cambios?.archivada !== undefined) setParams(p => { p.delete('c'); return p }, { replace: true })
  }, [setParams])

  const clientesPorId = useMemo(() => Object.fromEntries((datos?.clientes || []).map(c => [c.id, c])), [datos])
  const conversaciones = useMemo(() => (datos?.conversaciones || [])
    .filter(c => vista !== 'no_leidas' || c.noLeida || c.id === seleccionada), [datos, vista, seleccionada])
  const clientesConDms = (datos?.clientes || []).filter(c => c.permisosOk || c.noLeidas > 0)
  const totalNoLeidas = (datos?.clientes || []).reduce((s, c) => s + c.noLeidas, 0)
  const abrir = (id) => setParams(p => { p.set('c', id); return p })
  const conversacionActual = datos?.conversaciones.find(c => c.id === seleccionada)
  const clienteActual = clientesPorId[conversacionActual?.cliente_id]

  const pestana = (id, texto) => (
    <button key={id} type="button" onClick={() => setVista(id)} style={{
      ...botonSecundario, border: 'none', background: vista === id ? 'var(--text-primary)' : 'transparent',
      color: vista === id ? 'var(--bg-card)' : 'var(--text-secondary)',
    }}>{texto}</button>
  )

  const lista = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        {pestana('bandeja', 'Bandeja')}
        {pestana('no_leidas', `No leídas${totalNoLeidas ? ` (${totalNoLeidas})` : ''}`)}
        {pestana('archivadas', 'Archivadas')}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {!datos && !estado?.error && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px' }}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <div style={{ flex: 1 }}><Skeleton height={12} width="50%" style={{ marginBottom: 6 }} /><Skeleton height={11} width="80%" /></div>
          </div>
        ))}
        {datos && conversaciones.length === 0 && (
          <p style={{ ...textoSecundario, padding: 20, textAlign: 'center' }}>
            {vista === 'archivadas' ? 'No hay conversaciones archivadas.'
              : vista === 'no_leidas' ? 'Nada pendiente. Todo contestado.'
                : hayConectados ? 'Todavía no hay mensajes. Los nuevos llegan solos; si falta alguno, pulsa Sincronizar.'
                  : 'Aquí aparecerán los DMs cuando conectes el Instagram de un cliente.'}
          </p>
        )}
        {conversaciones.map(c => (
          <FilaConversacion key={c.id} c={c} cliente={clientesPorId[c.cliente_id]} activa={c.id === seleccionada}
            verCliente={!filtroCliente} onClick={() => abrir(c.id)} />
        ))}
      </div>
    </div>
  )

  const hilo = seleccionada ? (
    <Hilo key={seleccionada} conversacionId={seleccionada} cliente={clienteActual}
      onCambio={alCambiarConversacion}
      onVolver={movil ? () => setParams(p => { p.delete('c'); return p }) : null} />
  ) : (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <p style={{ ...textoSecundario, textAlign: 'center' }}>Elige una conversación para leerla y responder.</p>
    </div>
  )

  return (
    <div style={{ padding: movil ? '24px 16px' : '36px 40px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 4 }}>Bandeja de DMs</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Los mensajes de Instagram de todos tus clientes en un solo sitio</p>
        </div>
        <button type="button" style={botonSecundario} onClick={() => navigate('/instagram/dms')}><Zap size={13} /> Respuestas automáticas</button>
        <button type="button" style={{ ...botonSecundario, opacity: sincronizando ? 0.7 : 1 }} onClick={() => sincronizar()} disabled={sincronizando || !hayConectados}>
          <RefreshCw size={13} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      </div>

      {estado?.error && !datos && <Aviso tono="error">{estado.error.message}</Aviso>}
      {avisoSync && <Aviso tono={avisoSync.tono}>{avisoSync.texto}</Aviso>}
      {datos && !hayConectados && datos.clientes.length > 0 && (
        <Aviso tono="aviso">
          Ningún cliente tiene Instagram conectado con permiso para mensajes. Conéctalo (o vuelve a conectarlo) desde la ficha del cliente.
        </Aviso>
      )}

      {clientesConDms.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[{ id: '', nombre: 'Todos los clientes', noLeidas: totalNoLeidas }, ...clientesConDms].map(c => {
            const activo = filtroCliente === c.id
            return (
              <button key={c.id || 'todos'} type="button" onClick={() => { setFiltroCliente(c.id); setParams(p => { p.delete('c'); return p }, { replace: true }) }}
                style={{ ...botonSecundario, background: activo ? 'var(--text-primary)' : 'var(--bg-card)', color: activo ? 'var(--bg-card)' : 'var(--text-primary)' }}>
                {c.nombre}
                {c.noLeidas > 0 && <Chip tono="aviso">{c.noLeidas}</Chip>}
              </button>
            )
          })}
        </div>
      )}

      <div style={{
        flex: 1, minHeight: 360, display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(260px, 340px) 1fr',
        background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        {movil ? (seleccionada ? hilo : lista) : (
          <>
            <div style={{ borderRight: '1px solid var(--border-subtle)', minHeight: 0 }}>{lista}</div>
            <div style={{ minHeight: 0 }}>{hilo}</div>
          </>
        )}
      </div>
    </div>
  )
}
