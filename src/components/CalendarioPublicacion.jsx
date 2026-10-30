import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, ExternalLink, Eye, EyeOff, X, Trash2 } from 'lucide-react'
import PublicarInstagram from './PublicarInstagram'
import PublicarTikTok from './PublicarTikTok'
import { Tarjeta, Aviso, Chip } from './instagramUi'
import { botonPrimario, botonSecundario, textoSecundario, campoStyle } from './instagramEstilos'
import { useCalendarioMes, crearPost, actualizarPost, eliminarPost, getPostsCliente } from '../hooks/useCalendario'
import { getFechasMarcadas } from '../hooks/useInvestigacion'
import { fechasClaveDelMes } from '../utils/fechasClave'
import { getPublicacionesInstagram, conectarInstagram, programarPublicacionInstagram } from '../services/instagram'
import { getPublicacionesTikTok, moverPublicacionTikTok, esDeTikTok } from '../services/tiktok'
import { etiquetaFormato, formatoDe, esHistoria, FORMATOS_POST } from '../utils/formato'
import { FORMATOS_HUECO, RITMOS, ritmoDe, ocupacion, huecosLibresDelDia } from '../utils/huecos'
import { pasarAPorPublicar } from '../services/tareasAutomaticas'
import { useEsMovil } from '../hooks/useEsMovil'

// Calendario de publicación de un cliente: el mes (o la semana) con los posts y
// su estado de publicación en Instagram y en TikTok (con filtro por red), las fechas importantes, y a la
// derecha el formulario de PublicarInstagram al pulsar un post. Los posts se
// arrastran de un día a otro; el día y la hora del formulario mueven el post
// en el calendario (y la publicación programada en Instagram, si la hay). Lo usan la herramienta "Programar publicaciones" (solo posts
// de Instagram) y el paso "Publicar" de la ficha del cliente
// (todos los posts + huecos sugeridos de utils/huecos.js).
// En móvil, en vez de la rejilla se ve una agenda: los días con posts (y hoy)
// uno debajo de otro, con las mismas tarjetas. Arrastrar solo en escritorio.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ESTADOS = {
  programado: { tono: 'aviso', texto: 'Programado' },
  procesando: { tono: 'aviso', texto: 'Publicando' },
  publicado: { tono: 'ok', texto: 'Publicado' },
  error: { tono: 'error', texto: 'Error' },
  cancelado: { tono: 'neutro', texto: 'Cancelado' },
}

const esDeInstagram = (post) => post.red === 'instagram' || (post.comparteEn || []).includes('instagram')
// Posts que se pueden publicar desde Aify (Instagram y TikTok).
const sePublicaDesdeAify = (post) => esDeInstagram(post) || esDeTikTok(post)

// Estado que se ve en el calendario: el de la publicación desde Aify o, si no
// hay, el marcado a mano (programado o publicado fuera del programador).
const MARCAS_A_MANO = ['programado', 'publicado']
const estadoVisible = (post, pub) => (pub && pub.estado !== 'cancelado' ? pub.estado : MARCAS_A_MANO.includes(post.estado) ? post.estado : pub?.estado || null)
// Lo que se está publicando o ya salió desde Aify no se mueve de día.
const fijo = (...pubs) => pubs.some(pub => pub && ['procesando', 'publicado'].includes(pub.estado))

// Hora "HH:MM" de una fecha ISO en la hora local del navegador
const horaLocal = (isoStr) => {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechaPost(post) {
  const [y, m, d] = post.fecha.split('-').map(Number)
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  return post.hora ? `${dia} · ${post.hora.slice(0, 5)}` : dia
}

// Guiones aprobados por el cliente que aún no tienen fecha (en_calendario =
// false, 0030): desde «Nuevo post» se les pone día y hora sin escribirlos de nuevo.
function useAprobadosSinFecha(clienteId) {
  const [aprobados, setAprobados] = useState([])
  useEffect(() => {
    let vivo = true
    getPostsCliente(clienteId, { incluirSinProgramar: true }).then(({ data }) => {
      if (vivo) setAprobados((data || []).filter(p => p.enCalendario === false && p.aprobacionEstado === 'aprobado'))
    })
    return () => { vivo = false }
  }, [clienteId])
  return aprobados
}

const mesDe = (fechaIso) => (fechaIso || '').slice(0, 7)

// Dónde se publica: Instagram, TikTok o los dos (red instagram + comparte_en tiktok).
const REDES_POST = [
  { id: 'instagram', label: 'Instagram', red: 'instagram', comparteEn: [] },
  { id: 'tiktok', label: 'TikTok', red: 'tiktok', comparteEn: [] },
  { id: 'ambas', label: 'Instagram y TikTok', red: 'instagram', comparteEn: ['tiktok'] },
]

function NuevoPost({ clienteId, fechaInicial, formatoInicial, onCreado, onCancelar }) {
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(fechaInicial || hoyISO())
  const [hora, setHora] = useState('12:00')
  const [formato, setFormato] = useState(formatoInicial || 'video')
  const [redes, setRedes] = useState('instagram')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const aprobados = useAprobadosSinFecha(clienteId)
  const [elegidoId, setElegidoId] = useState(null)
  // Primero los del mes de la fecha elegida; luego el resto
  const aprobadosOrden = [...aprobados].sort((a, b) => (mesDe(a.fecha) === mesDe(fecha) ? 0 : 1) - (mesDe(b.fecha) === mesDe(fecha) ? 0 : 1))
  const guionElegido = aprobados.find(p => p.id === elegidoId) || null

  const elegir = (post) => {
    if (elegidoId === post.id) { setElegidoId(null); setTitulo(''); return }
    setElegidoId(post.id); setTitulo(post.titulo || ''); setFormato(formatoDe(post))
  }

  const crear = async (e) => {
    e.preventDefault()
    if (!titulo.trim() || !fecha) return setError('Pon un título y una fecha.')
    setGuardando(true)
    const destino = REDES_POST.find(r => r.id === redes) || REDES_POST[0]
    let resultado
    if (guionElegido) {
      // El guion ya existe: solo se le pone fecha y entra en el calendario
      resultado = await actualizarPost(clienteId, guionElegido.id, { fecha, hora, formato, enCalendario: true, red: destino.red, comparteEn: destino.comparteEn })
      if (resultado.data) await pasarAPorPublicar(resultado.data).catch(err => console.warn('[CalendarioPublicacion] no se pudo mover la tarea:', err.message))
    } else {
      resultado = await crearPost({
        clienteId, fecha, hora, red: destino.red, comparteEn: destino.comparteEn, titulo: titulo.trim(), formato, estado: 'borrador',
      })
    }
    setGuardando(false)
    if (resultado.error || !resultado.data) return setError('No se pudo crear el post.')
    onCreado(resultado.data)
  }

  return (
    <form onSubmit={crear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {error && <Aviso tono="error" style={{ width: '100%', marginBottom: 4 }}>{error}</Aviso>}
      <input style={{ ...campoStyle, flex: '1 1 100%' }} value={titulo} readOnly={!!guionElegido}
        onChange={e => setTitulo(e.target.value)} placeholder="Título del post" maxLength={120} autoFocus />
      <input type="date" style={{ ...campoStyle, flex: '1 1 140px', width: 'auto' }} value={fecha} onChange={e => setFecha(e.target.value)} />
      <input type="time" style={{ ...campoStyle, flex: '0 0 auto', width: 'auto' }} value={hora} onChange={e => setHora(e.target.value)} />
      <div style={{ display: 'flex', gap: 4, width: '100%', flexWrap: 'wrap' }}>
        {REDES_POST.map(r => (
          <button key={r.id} type="button" onClick={() => setRedes(r.id)}
            style={{ ...botonSecundario, ...(redes === r.id ? { background: 'var(--text-primary)', color: 'var(--bg-card)', borderColor: 'var(--text-primary)' } : { background: 'var(--bg-card)' }) }}>
            {r.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        {FORMATOS_POST.map(f => (
          <button key={f.id} type="button" onClick={() => setFormato(f.id)}
            style={{ ...botonSecundario, ...(formato === f.id ? { background: 'var(--text-primary)', color: 'var(--bg-card)', borderColor: 'var(--text-primary)' } : { background: 'var(--bg-card)' }) }}>
            {f.label}
          </button>
        ))}
      </div>
      <button type="submit" style={{ ...botonPrimario, opacity: guardando ? 0.7 : 1 }} disabled={guardando}>{guardando ? 'Guardando…' : guionElegido ? 'Poner en el calendario' : 'Crear'}</button>
      <button type="button" style={botonSecundario} onClick={onCancelar}>Cancelar</button>

      <div style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
          Guiones aprobados sin fecha{aprobados.length ? ` · ${aprobados.length}` : ''}
        </div>
        {aprobados.length === 0 ? (
          <p style={{ ...textoSecundario, margin: 0 }}>Cuando el cliente apruebe guiones, salen aquí para ponerlos en el calendario.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {aprobadosOrden.map(p => {
              const activo = p.id === elegidoId
              return (
                <button key={p.id} type="button" onClick={() => elegir(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    border: `1px solid ${activo ? 'var(--text-primary)' : 'var(--border-color)'}`, background: activo ? 'var(--text-primary)' : 'var(--bg-card)', color: activo ? 'var(--bg-card)' : 'var(--text-primary)' }}>
                  <Chip>{etiquetaFormato(formatoDe(p))}</Chip>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo || 'Sin título'}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </form>
  )
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const COLOR_ESTADO = { programado: '#FF9500', procesando: '#FF9500', publicado: '#30A46C', error: '#FF3B30', cancelado: '#AEAEB2' }

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lunesDe = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
const masDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

// Hueco sugerido → formato con el que se crea el post
const FORMATO_DE_HUECO = { reel: 'video', carrusel: 'carrusel', historias: 'historia' }
const CLAVE_HUECOS = 'aify_calendario_huecos'
const CLAVE_VISTA = 'aify_calendario_vista'
const CLAVE_RED = 'aify_calendario_red'

// Filtro por red de la barra: todas, solo lo que sale en Instagram o solo lo que sale en TikTok
const FILTROS_RED = [
  { id: 'todas', label: 'Todas' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
]
const pasaFiltroRed = (post, filtro) => (filtro === 'instagram' ? esDeInstagram(post) : filtro === 'tiktok' ? esDeTikTok(post) : true)

function leer(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto } catch { return porDefecto }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento */ }
}

function FechaImportante({ f }) {
  const estilos = {
    propia: { background: '#D7FF3D', color: '#0B0C10' },
    general: { background: '#F1F8C9', color: '#0B0C10' },
    marcada: { background: 'rgba(29,95,224,0.10)', color: '#1D5FE0' },
  }[f.tipo] || {}
  const titulo = { propia: `Fecha del cliente: ${f.label}`, general: f.label, marcada: `Marcada en Investigación: ${f.label}` }[f.tipo]
  return (
    <div title={titulo} style={{ ...estilos, maxWidth: '100%', fontSize: 10, fontWeight: 700, lineHeight: 1.3, padding: '2px 6px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {f.label}
    </div>
  )
}

// Sin publicar / Programado / Publicado a mano: para contar lo que se programó
// o se subió a Instagram fuera del programador de Aify. Si la publicación va
// por Aify, manda su estado y no se toca aquí.
const OPCIONES_ESTADO = [
  { id: 'borrador', texto: 'Sin publicar', color: 'var(--text-primary)' },
  { id: 'programado', texto: 'Programado', color: '#FF9500' },
  { id: 'publicado', texto: 'Publicado', color: '#30A46C' },
]

function MarcaPublicado({ post, pub, onCambiar }) {
  const desdeAify = pub && pub.estado !== 'cancelado' && pub.estado !== 'error'
  const actual = desdeAify
    ? (pub.estado === 'procesando' ? 'programado' : pub.estado)
    : MARCAS_A_MANO.includes(post.estado) ? post.estado : 'borrador'
  return (
    <div style={{ marginBottom: 14 }}>
      <div role="radiogroup" aria-label="Estado de publicación" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--bg-secondary)' }}>
        {OPCIONES_ESTADO.map(o => {
          const activa = actual === o.id
          return (
            <button key={o.id} type="button" role="radio" aria-checked={activa} disabled={desdeAify}
              onClick={() => !activa && onCambiar(o.id)}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                cursor: desdeAify ? 'default' : 'pointer', opacity: desdeAify && !activa ? 0.5 : 1,
                border: 'none',
                background: activa ? (o.id === 'borrador' ? 'var(--bg-card)' : o.color) : 'transparent',
                color: activa ? (o.id === 'borrador' ? 'var(--text-primary)' : '#fff') : 'var(--text-secondary)',
                boxShadow: activa ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {o.texto}
            </button>
          )
        })}
      </div>
      <p style={{ ...textoSecundario, fontSize: 11, margin: '6px 0 0' }}>
        {desdeAify
          ? (actual === 'publicado' ? 'Publicado desde Aify.' : 'Programado desde Aify: cambia o cancela la programación más abajo.')
          : 'Si lo programaste o lo subiste a Instagram por tu cuenta, márcalo aquí para que cuente en el recuento.'}
      </p>
    </div>
  )
}

// Borrar el post (segundo clic confirma). Lo que se está publicando no se toca;
// lo programado en Aify se cancela con el post (la publicación cae en cascada).
// Instagram no deja borrar desde fuera lo ya publicado: ahí solo sale de Aify.
function BorrarPost({ post, pub, onBorrar, red = 'Instagram' }) {
  const [confirmar, setConfirmar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  if (pub?.estado === 'procesando') return null
  const enInstagram = pub?.estado === 'publicado' || post.estado === 'publicado'
  const aviso = pub?.estado === 'programado'
    ? `Se cancela también la publicación programada en ${red}.`
    : enInstagram ? `Solo se borra de Aify: en ${red} sigue publicado.` : null
  const borrar = async () => {
    if (!confirmar) return setConfirmar(true)
    setBorrando(true)
    await onBorrar()
    setBorrando(false)
  }
  return (
    <>
      <button type="button" onClick={borrar} disabled={borrando} onBlur={() => !borrando && setConfirmar(false)}
        title={confirmar ? (aviso || 'Pulsa otra vez para borrar el post') : 'Borrar post'}
        aria-label={confirmar ? 'Confirmar borrar post' : 'Borrar post'}
        style={{ ...botonSecundario, ...(confirmar ? { background: '#FF3B30', borderColor: '#FF3B30', color: '#fff' } : {}), opacity: borrando ? 0.6 : 1 }}>
        <Trash2 size={12} />{confirmar && (borrando ? ' Borrando…' : ' ¿Borrar?')}
      </button>
      {confirmar && aviso && <span style={{ ...textoSecundario, fontSize: 11, alignSelf: 'center' }}>{aviso}</span>}
    </>
  )
}

// En móvil el panel del post (programar o crear) se abre como hoja inferior a
// casi toda la pantalla, como las de iOS: asa arriba, se cierra deslizándola
// hacia abajo, tocando el fondo o con su X.
const CIERRE_DESLIZANDO = 110

function HojaInferior({ onCerrar, children }) {
  const [arrastre, setArrastre] = useState(null) // { inicio, dy } mientras se desliza
  const dy = arrastre?.dy || 0

  // Sin scroll de la página de debajo mientras la hoja está abierta
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [])

  const empezar = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setArrastre({ inicio: e.clientY, dy: 0 })
  }
  const moverAsa = (e) => {
    if (arrastre) setArrastre({ ...arrastre, dy: Math.max(0, e.clientY - arrastre.inicio) })
  }
  const soltar = () => {
    if (dy > CIERRE_DESLIZANDO) onCerrar()
    setArrastre(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
      <div onClick={onCerrar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: Math.max(0.3, 1 - dy / 400) }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 'calc(100dvh - env(safe-area-inset-top) - 24px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-secondary)', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        transform: `translateY(${dy}px)`, transition: arrastre ? 'none' : 'transform 0.25s ease',
        animation: 'aify-hoja-sube 0.28s ease',
      }}>
        <div onPointerDown={empezar} onPointerMove={moverAsa} onPointerUp={soltar} onPointerCancel={soltar}
          aria-hidden="true"
          style={{ flexShrink: 0, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: 'grab' }}>
          <span style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--text-tertiary, #AEAEB2)', opacity: 0.6 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px calc(16px + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function CalendarioPublicacion({ cliente, cabecera = null, conHuecos = false }) {
  const hoyStr = hoyISO()
  const esMovil = useEsMovil()
  const [vista, setVista] = useState(() => (leer(CLAVE_VISTA, 'mes') === 'semana' ? 'semana' : 'mes'))
  // Referencia de lo que se ve: el día 1 del mes (vista mes) o el lunes (vista semana)
  const [ref, setRef] = useState(() => new Date())
  const [abierto, setAbierto] = useState(null) // id del post seleccionado
  const [creando, setCreando] = useState(null) // { fecha, formato? } del post nuevo
  const [mostrarHuecos, setMostrarHuecos] = useState(() => leer(CLAVE_HUECOS, 'si') !== 'no')
  const [filtroRed, setFiltroRed] = useState(() => (FILTROS_RED.some(f => f.id === leer(CLAVE_RED, 'todas')) ? leer(CLAVE_RED, 'todas') : 'todas'))
  const [recarga, setRecarga] = useState(0)
  const clave = `${cliente.id}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [estadoTikTok, setEstadoTikTok] = useState(null) // { clave, data?, error? }

  // Días visibles
  const dias = vista === 'semana'
    ? Array.from({ length: 7 }, (_, i) => masDias(lunesDe(ref), i))
    : (() => {
        const primero = new Date(ref.getFullYear(), ref.getMonth(), 1)
        const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
        const lista = [...Array((primero.getDay() + 6) % 7).fill(null)]
        for (let d = 1; d <= ultimo.getDate(); d++) lista.push(new Date(ref.getFullYear(), ref.getMonth(), d))
        while (lista.length % 7) lista.push(null)
        return lista
      })()
  const reales = dias.filter(Boolean)
  const desde = iso(reales[0])
  const hasta = iso(reales[reales.length - 1])
  // Una semana puede caer entre dos meses: se piden los dos (si es el mismo, el segundo repite).
  const a = reales[0]
  const b = reales[reales.length - 1]
  const mesA = useCalendarioMes(cliente.id, a.getFullYear(), a.getMonth())
  const mesB = useCalendarioMes(cliente.id, b.getFullYear(), b.getMonth())
  const loading = mesA.loading || mesB.loading
  const refetch = () => { mesA.refetch?.(); mesB.refetch?.() }
  // Cambios hechos aquí (arrastrar, día/hora del panel, publicado a mano): se ven
  // al momento, sin esperar a que vuelva la consulta.
  const [cambiados, setCambiados] = useState({}) // { [postId]: { fecha?, hora?, estado? } }
  const [borrados, setBorrados] = useState(() => new Set())
  const posts = [...new Map([...mesA.posts, ...mesB.posts].map(p => [p.id, p])).values()]
    .filter(p => !borrados.has(p.id))
    .map(p => (cambiados[p.id] ? { ...p, ...cambiados[p.id] } : p))
  const [errorCambio, setErrorCambio] = useState(null)
  const [arrastrando, setArrastrando] = useState(null) // id del post
  const [sobre, setSobre] = useState(null) // fecha del día bajo el cursor

  // En la ficha se ven todos los posts (cuentan para los huecos); en la herramienta, solo Instagram y TikTok.
  // Encima, el filtro por red de la barra.
  const postsVisibles = posts
    .filter(p => UUID_RE.test(p.id || '') && p.enCalendario !== false && p.fecha >= desde && p.fecha <= hasta && (conHuecos || sePublicaDesdeAify(p)) && pasaFiltroRed(p, filtroRed))
    .sort((x, y) => (x.fecha + (x.hora || '')).localeCompare(y.fecha + (y.hora || '')))
  const porDia = {}
  for (const p of postsVisibles) (porDia[p.fecha] ||= []).push(p)

  const ritmo = ritmoDe(cliente)
  const ocupados = ocupacion(posts)
  const huecosDe = (fecha) => (conHuecos && mostrarHuecos ? huecosLibresDelDia(ritmo, fecha, ocupados, hoyStr) : [])

  // Fechas importantes: las del onboarding (generales y propias) y las marcadas en Investigación
  const fechasOnboarding = {}
  for (const d of [a, b]) {
    const delMes = fechasClaveDelMes(cliente.fechasClaveObj, d.getFullYear(), d.getMonth())
    for (const [dia, lista] of Object.entries(delMes)) fechasOnboarding[iso(new Date(d.getFullYear(), d.getMonth(), Number(dia)))] = lista
  }
  const claveMarcadas = `${cliente.id}|${desde}|${hasta}`
  const [marcadas, setMarcadas] = useState(null) // { clave, porFecha }
  useEffect(() => {
    let activo = true
    getFechasMarcadas(cliente.id, { desde, hasta }).then(({ data }) => {
      if (!activo) return
      const porFecha = {}
      for (const f of data || []) if (f.titulo) (porFecha[f.fecha] ||= []).push({ label: f.titulo, tipo: 'marcada' })
      setMarcadas({ clave: claveMarcadas, porFecha })
    }).catch(() => {})
    return () => { activo = false }
  }, [cliente.id, desde, hasta, claveMarcadas])
  const fechasDe = (fecha) => [...(fechasOnboarding[fecha] || []), ...((marcadas?.clave === claveMarcadas && marcadas.porFecha[fecha]) || [])]

  useEffect(() => {
    let activo = true
    getPublicacionesInstagram(cliente.id)
      .then(data => { if (activo) setEstado({ clave, data }) })
      .catch(error => { if (activo) setEstado({ clave, error }) })
    // TikTok aparte: si falla (sin migración, sin configurar) el calendario sigue con Instagram.
    getPublicacionesTikTok(cliente.id)
      .then(data => { if (activo) setEstadoTikTok({ clave, data }) })
      .catch(error => { if (activo) setEstadoTikTok({ clave, error }) })
    return () => { activo = false }
  }, [cliente.id, clave])

  const actual = estado?.clave === clave ? estado : null
  const porPost = Object.fromEntries((actual?.data?.publicaciones || []).map(p => [p.post_id, p]))
  const actualTikTok = estadoTikTok?.clave === clave ? estadoTikTok : null
  const porPostTikTok = Object.fromEntries((actualTikTok?.data?.publicaciones || []).map(p => [p.post_id, p]))
  // La publicación que manda en el color y el recuento: la de Instagram y, si
  // no hay (o está cancelada), la de TikTok.
  const pubPrincipal = (postId) => (porPost[postId] && porPost[postId].estado !== 'cancelado' ? porPost[postId] : porPostTikTok[postId] || porPost[postId])
  // Con el filtro de una red, la tarjeta y el recuento enseñan el estado de esa red.
  const pubDelFiltro = (postId) => (filtroRed === 'tiktok' ? porPostTikTok[postId] : filtroRed === 'instagram' ? porPost[postId] : pubPrincipal(postId))
  const recargar = () => { setRecarga(r => r + 1); refetch() }
  const seleccionado = postsVisibles.find(p => p.id === abierto) || posts.find(p => p.id === abierto) || null

  // Guarda fecha/hora/estado de un post. Si tiene una publicación programada en
  // Instagram, se reprograma con la misma hora en el nuevo día (o la nueva hora);
  // si la tiene en TikTok, se mueve su hora. Sin useCallback: porPost cambia en
  // cada render y el React Compiler ya memoriza lo que puede.
  const cambiarPost = async (post, cambios) => {
    setErrorCambio(null)
    const antes = { fecha: post.fecha, hora: post.hora, estado: post.estado }
    setCambiados(c => ({ ...c, [post.id]: { ...c[post.id], ...cambios } }))
    const { error } = await actualizarPost(cliente.id, post.id, cambios)
    if (error) {
      setCambiados(c => ({ ...c, [post.id]: { ...c[post.id], ...antes } }))
      return setErrorCambio('No se pudo guardar el cambio del post.')
    }
    // Con fecha en el calendario, su tarjeta de producción pasa a «Por publicar» (#85)
    if (cambios.enCalendario === true || (cambios.fecha && post.enCalendario !== false)) {
      await pasarAPorPublicar({ ...post, ...cambios }).catch(e => console.warn('[CalendarioPublicacion] no se pudo mover la tarea:', e.message))
    }
    const pub = porPost[post.id]
    if (pub?.estado === 'programado' && (cambios.fecha || cambios.hora)) {
      const fecha = cambios.fecha || post.fecha
      const hora = cambios.hora || horaLocal(pub.publicar_en)
      try {
        await programarPublicacionInstagram(cliente.id, post.id, {
          tipo: pub.tipo, archivos: pub.archivos, portadaRuta: pub.portada_ruta, caption: pub.caption || '',
          compartirEnFeed: pub.compartir_en_feed, publicarEn: new Date(`${fecha}T${hora}:00`).toISOString(),
        })
        setRecarga(r => r + 1)
      } catch (err) {
        setErrorCambio(`El post se ha movido, pero la publicación de Instagram sigue a su hora: ${err.message}`)
      }
    }
    const pubTikTok = porPostTikTok[post.id]
    if (pubTikTok?.estado === 'programado' && (cambios.fecha || cambios.hora)) {
      const fecha = cambios.fecha || post.fecha
      const hora = cambios.hora || horaLocal(pubTikTok.publicar_en)
      try {
        await moverPublicacionTikTok(cliente.id, post.id, new Date(`${fecha}T${hora}:00`).toISOString())
        setRecarga(r => r + 1)
      } catch (err) {
        setErrorCambio(`El post se ha movido, pero la publicación de TikTok sigue a su hora: ${err.message}`)
      }
    }
  }

  const borrarPost = async (post) => {
    setErrorCambio(null)
    const { error } = await eliminarPost(cliente.id, post.id)
    if (error) return setErrorCambio('No se pudo borrar el post.')
    setBorrados(b => new Set(b).add(post.id))
    setAbierto(null)
    recargar()
  }

  const soltar = (fecha) => {
    const post = posts.find(p => p.id === arrastrando)
    setArrastrando(null)
    setSobre(null)
    if (post && fecha && post.fecha !== fecha) cambiarPost(post, { fecha })
  }

  const mover = (delta) => {
    setRef(r => (vista === 'semana' ? masDias(lunesDe(r), 7 * delta) : new Date(r.getFullYear(), r.getMonth() + delta, 1)))
    setAbierto(null)
    setCreando(null)
  }
  const cambiarVista = (v) => {
    setVista(v)
    guardar(CLAVE_VISTA, v)
    // Al pasar a semana se abre la de hoy si es de este mes; si no, la primera del mes
    if (v === 'semana') setRef(r => (r.getMonth() === new Date().getMonth() && r.getFullYear() === new Date().getFullYear() ? new Date() : new Date(r.getFullYear(), r.getMonth(), 1)))
  }

  const conteo = postsVisibles.reduce((acc, p) => {
    const e = estadoVisible(p, pubDelFiltro(p.id))
    if (e) acc[e] = (acc[e] || 0) + 1
    return acc
  }, {})

  const tituloPeriodo = vista === 'semana'
    ? `${reales[0].getDate()} ${MESES[reales[0].getMonth()].slice(0, 3)} – ${reales[6].getDate()} ${MESES[reales[6].getMonth()].slice(0, 3)} ${reales[6].getFullYear()}`
    : `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
  const semanal = vista === 'semana'
  const panelAbierto = Boolean(seleccionado || creando)

  const cerrarPanel = () => {
    if (creando) setCreando(null)
    else { setAbierto(null); recargar() }
  }

  // Tarjeta de un post: la misma en la rejilla y en la agenda del móvil.
  // `grande` = vista semana (o agenda): título en varias líneas.
  const tarjetaPost = (post, grande) => {
    const pub = pubDelFiltro(post.id)
    const est = estadoVisible(post, pub)
    // Si también va a TikTok (y no es la que manda), su estado se ve aparte; con el filtro de Instagram, no.
    const pubTikTok = porPostTikTok[post.id]
    const estTikTok = filtroRed !== 'instagram' && pubTikTok && pubTikTok !== pub && pubTikTok.estado !== 'cancelado' ? pubTikTok.estado : null
    const color = est ? COLOR_ESTADO[est] : 'var(--border-color)'
    const activo = abierto === post.id
    const movible = !fijo(porPost[post.id], pubTikTok) && !esMovil
    return (
      <button key={post.id} type="button" onClick={() => { setAbierto(activo ? null : post.id); setCreando(null) }}
        draggable={movible}
        onDragStart={movible ? (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', post.id); setArrastrando(post.id) } : undefined}
        onDragEnd={() => { setArrastrando(null); setSobre(null) }}
        title={`${post.titulo || 'Post'}${est ? ` · ${ESTADOS[est]?.texto || est}` : ''}${estTikTok ? ` · TikTok: ${ESTADOS[estTikTok]?.texto || estTikTok}` : ''}${movible ? ' · Arrástralo a otro día para moverlo' : ''}`}
        style={{
          textAlign: 'left', border: 'none', borderLeft: `3px solid ${color}`, borderRadius: 5, padding: grande ? '7px 8px' : '4px 6px', cursor: movible ? 'grab' : 'pointer', fontFamily: 'inherit',
          background: activo ? 'rgba(29,95,224,0.12)' : 'var(--bg-secondary)', minWidth: 0, opacity: arrastrando === post.id ? 0.4 : 1,
          ...(esMovil ? { minHeight: 44 } : {}),
        }}>
        <div style={{ fontSize: grande ? 12 : 11, fontWeight: 600, color: 'var(--text-primary)', ...(grande ? { lineHeight: 1.35 } : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
          {post.hora ? `${post.hora.slice(0, 5)} ` : ''}{post.titulo || 'Sin título'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          {!esDeInstagram(post) && `${esDeTikTok(post) ? 'TikTok' : post.red || 'otra red'} · `}{esHistoria(post) ? 'Historia' : etiquetaFormato(formatoDe(post))}{est ? ` · ${ESTADOS[est]?.texto || est}` : ''}
        </div>
        {estTikTok && (
          <div style={{ fontSize: 10, color: COLOR_ESTADO[estTikTok] || 'var(--text-secondary)', fontWeight: 600 }}>
            TikTok · {ESTADOS[estTikTok]?.texto || estTikTok}
          </div>
        )}
      </button>
    )
  }

  const botonHueco = (fecha, f, grande) => {
    const h = FORMATOS_HUECO[f]
    return (
      <button key={f} type="button" onClick={() => { setCreando({ fecha, formato: FORMATO_DE_HUECO[f] }); setAbierto(null) }}
        title={`${h.texto} este día: es de los mejores días para ${h.label.toLowerCase()} con ritmo ${RITMOS[ritmo].label.toLowerCase()}. Pulsa para crear el post.`}
        style={{
          textAlign: 'left', fontSize: 10, fontWeight: 600, padding: grande ? '6px 8px' : '3px 6px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
          color: h.color, border: `1px dashed ${h.color}80`, background: 'transparent', opacity: 0.7,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          ...(esMovil ? { minHeight: 36 } : {}),
        }}>
        {grande ? `${h.texto} este día` : h.label}
      </button>
    )
  }

  // Agenda del móvil: los días visibles con posts, y hoy aunque esté vacío
  const diasAgenda = reales.filter(d => (porDia[iso(d)] || []).length > 0 || iso(d) === hoyStr)
  const agenda = (
    <div style={{ display: 'flex', flexDirection: 'column', opacity: loading ? 0.5 : 1 }}>
      {diasAgenda.map((d, i) => {
        const fecha = iso(d)
        const esHoy = fecha === hoyStr
        return (
          <div key={fecha} style={{ padding: '10px 12px 12px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: fecha < hoyStr ? 'var(--text-tertiary, #AEAEB2)' : 'var(--text-primary)' }}>
                {DIAS_SEMANA[(d.getDay() + 6) % 7]} {d.getDate()}
                {esHoy && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#1D5FE0', borderRadius: 10, padding: '2px 8px' }}>Hoy</span>}
              </span>
              <button type="button" aria-label={`Nuevo post el ${d.getDate()}`} title="Nuevo post"
                onClick={() => { setCreando({ fecha }); setAbierto(null) }}
                style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </div>
            {fechasDe(fecha).map(f => <FechaImportante key={`${f.tipo}-${f.label}`} f={f} />)}
            {(porDia[fecha] || []).map(post => tarjetaPost(post, true))}
            {huecosDe(fecha).map(f => botonHueco(fecha, f, true))}
          </div>
        )
      })}
    </div>
  )

  const celda = (d, i) => {
    const fecha = d ? iso(d) : null
    const delDia = fecha ? porDia[fecha] || [] : []
    const importantes = fecha ? fechasDe(fecha) : []
    const esHoy = fecha === hoyStr
    const destino = fecha && arrastrando && sobre === fecha
    return (
      <div key={i}
        onDragOver={fecha && arrastrando ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== fecha) setSobre(fecha) } : undefined}
        onDrop={fecha && arrastrando ? (e) => { e.preventDefault(); soltar(fecha) } : undefined}
        style={{
        minHeight: semanal ? 460 : 112, padding: 6, borderRight: (i % 7) !== 6 ? '1px solid var(--border-subtle)' : 'none',
        borderBottom: !semanal && i < dias.length - 7 ? '1px solid var(--border-subtle)' : 'none',
        background: destino ? 'rgba(29,95,224,0.10)' : d ? (esHoy && semanal ? 'rgba(29,95,224,0.03)' : 'transparent') : 'var(--bg-secondary)',
        outline: destino ? '2px dashed rgba(29,95,224,0.5)' : 'none', outlineOffset: -3,
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
      }}>
        {d && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 12, fontWeight: 600, minWidth: 22, height: 22, padding: '0 4px', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: esHoy ? '#1D5FE0' : 'transparent', color: esHoy ? '#fff' : (fecha < hoyStr ? 'var(--text-tertiary, #AEAEB2)' : 'var(--text-primary)'),
            }}>{d.getDate()}</span>
            <button type="button" aria-label={`Nuevo post el ${d.getDate()}`} title="Nuevo post"
              onClick={() => { setCreando({ fecha }); setAbierto(null) }}
              style={{ width: 18, height: 18, borderRadius: 5, border: 'none', background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <Plus size={11} />
            </button>
          </div>
        )}
        {importantes.map(f => <FechaImportante key={`${f.tipo}-${f.label}`} f={f} />)}
        {delDia.map(post => tarjetaPost(post, semanal))}
        {fecha && huecosDe(fecha).map(f => botonHueco(fecha, f, semanal))}
      </div>
    )
  }

  // En móvil los botones de la barra miden al menos 44 px de alto
  const tactil = esMovil ? { minHeight: 44 } : {}
  // Botones de icono de la cabecera del panel: 44 × 44 en móvil
  const tactilCerrar = esMovil ? { minWidth: 44, minHeight: 44, justifyContent: 'center' } : {}

  // Contenido del panel del post: al lado del calendario en escritorio y en
  // una hoja inferior en móvil.
  const contenidoPanel = panelAbierto && (creando ? (
    <Tarjeta titulo="Nuevo post" accion={<button type="button" style={{ ...botonSecundario, ...tactilCerrar }} onClick={() => setCreando(null)} aria-label="Cerrar"><X size={12} /></button>}>
      <NuevoPost key={`${creando.fecha}-${creando.formato || ''}`} clienteId={cliente.id} fechaInicial={creando.fecha} formatoInicial={creando.formato} onCancelar={() => setCreando(null)}
        onCreado={(post) => {
          setCreando(null)
          refetch()
          setAbierto(post.id)
        }} />
    </Tarjeta>
    ) : (
    <Tarjeta titulo={seleccionado.titulo || 'Post sin título'} accion={
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <BorrarPost key={seleccionado.id} post={seleccionado} pub={pubPrincipal(seleccionado.id)} onBorrar={() => borrarPost(seleccionado)}
          red={pubPrincipal(seleccionado.id) && pubPrincipal(seleccionado.id) === porPostTikTok[seleccionado.id] ? 'TikTok' : 'Instagram'} />
        {porPost[seleccionado.id]?.permalink && (
          <a href={porPost[seleccionado.id].permalink} target="_blank" rel="noreferrer" style={{ ...botonSecundario, ...tactilCerrar, textDecoration: 'none' }} title="Ver en Instagram">
            <ExternalLink size={12} />
          </a>
        )}
        {porPostTikTok[seleccionado.id]?.enlace && (
          <a href={porPostTikTok[seleccionado.id].enlace} target="_blank" rel="noreferrer" style={{ ...botonSecundario, ...tactilCerrar, textDecoration: 'none' }} title="Ver en TikTok">
            <ExternalLink size={12} /> TikTok
          </a>
        )}
        <button type="button" style={{ ...botonSecundario, ...tactilCerrar }} onClick={cerrarPanel} aria-label="Cerrar"><X size={12} /></button>
      </div>
    }>
      <p style={{ ...textoSecundario, marginBottom: 12, textTransform: 'capitalize' }}>
        {fechaPost(seleccionado)} · {esHistoria(seleccionado) ? 'Historia' : etiquetaFormato(formatoDe(seleccionado))}
      </p>
      <MarcaPublicado post={seleccionado} pub={pubPrincipal(seleccionado.id)}
        onCambiar={(estado) => cambiarPost(seleccionado, { estado })} />
      {esDeInstagram(seleccionado) && (
        <PublicarInstagram key={seleccionado.id} clienteId={cliente.id} cliente={cliente} post={seleccionado} abiertoInicial
          onCambiar={(cambios) => cambiarPost(seleccionado, cambios)} />
      )}
      {/* Un post de las dos redes tiene una publicación en cada una; la fecha la lleva el de Instagram. */}
      {esDeTikTok(seleccionado) && (
        <div style={esDeInstagram(seleccionado) ? { marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' } : undefined}>
          <PublicarTikTok key={`tiktok-${seleccionado.id}`} clienteId={cliente.id} post={seleccionado} abiertoInicial={!esDeInstagram(seleccionado)}
            onCambiar={esDeInstagram(seleccionado) ? null : (cambios) => cambiarPost(seleccionado, cambios)} />
        </div>
      )}
      {!sePublicaDesdeAify(seleccionado) && (
        <p style={{ ...textoSecundario, margin: 0 }}>Este post es de {seleccionado.red || 'otra red'}: desde Aify, de momento, solo se publica en Instagram y TikTok.</p>
      )}
    </Tarjeta>
  ))

  const segmento = (activo) => ({
    ...tactil,
    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    background: activo ? 'var(--bg-card)' : 'transparent', color: activo ? 'var(--text-primary)' : 'var(--text-secondary)',
    boxShadow: activo ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {cabecera}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '0 4px' }}>
          <button type="button" onClick={() => mover(-1)} aria-label={semanal ? 'Semana anterior' : 'Mes anterior'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: 'var(--text-secondary)', ...(esMovil ? { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' } : {}) }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: esMovil ? 120 : 150, textAlign: 'center', textTransform: semanal ? 'none' : 'capitalize' }}>{tituloPeriodo}</span>
          <button type="button" onClick={() => mover(1)} aria-label={semanal ? 'Semana siguiente' : 'Mes siguiente'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: 'var(--text-secondary)', ...(esMovil ? { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' } : {}) }}><ChevronRight size={16} /></button>
        </div>
        <div role="tablist" aria-label="Vista del calendario" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--bg-secondary)' }}>
          <button type="button" role="tab" aria-selected={!semanal} style={segmento(!semanal)} onClick={() => cambiarVista('mes')}>Mes</button>
          <button type="button" role="tab" aria-selected={semanal} style={segmento(semanal)} onClick={() => cambiarVista('semana')}>Semana</button>
        </div>
        <div role="tablist" aria-label="Filtrar por red" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--bg-secondary)' }}>
          {FILTROS_RED.map(f => (
            <button key={f.id} type="button" role="tab" aria-selected={filtroRed === f.id} style={segmento(filtroRed === f.id)}
              onClick={() => { setFiltroRed(f.id); guardar(CLAVE_RED, f.id) }}>
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" style={{ ...botonSecundario, ...tactil }} onClick={recargar}><RefreshCw size={13} /> Actualizar</button>
        {conHuecos && (
          <button type="button" style={{ ...botonSecundario, ...tactil, color: mostrarHuecos ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            title={`Huecos sugeridos · ritmo ${RITMOS[ritmo].label.toLowerCase()}${cliente.ritmoPublicacion ? '' : ' (por defecto)'}: ${RITMOS[ritmo].resumen}`}
            onClick={() => { const v = !mostrarHuecos; setMostrarHuecos(v); guardar(CLAVE_HUECOS, v ? 'si' : 'no') }}>
            {mostrarHuecos ? <Eye size={13} /> : <EyeOff size={13} />} Huecos
          </button>
        )}
        {!creando && <button type="button" style={{ ...botonSecundario, ...tactil }} onClick={() => { setCreando({ fecha: hoyStr }); setAbierto(null) }}><Plus size={13} /> Nuevo post</button>}
        {Object.keys(conteo).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {Object.entries(conteo).map(([e, n]) => <Chip key={e} tono={ESTADOS[e]?.tono}>{n} {(ESTADOS[e]?.texto || e).toLowerCase()}</Chip>)}
          </div>
        )}
      </div>

      {actual?.error && <Aviso tono="error">{actual.error.message}</Aviso>}
      {errorCambio && <Aviso tono="error">{errorCambio}</Aviso>}
      {filtroRed !== 'tiktok' && actual?.data && (!actual.data.conectado || !actual.data.permisosOk) && (
        <Aviso tono="aviso">
          {actual.data.conectado
            ? 'Vuelve a conectar el Instagram de este cliente para poder publicar desde Aify (hacen falta permisos nuevos). '
            : 'Conecta el Instagram de este cliente para poder publicar desde Aify. '}
          <button type="button" onClick={() => conectarInstagram(cliente.id).catch(() => {})}
            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            {actual.data.conectado ? 'Volver a conectar' : 'Conectar Instagram'}
          </button>
        </Aviso>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Calendario (en móvil, sin días que enseñar no se pinta la caja vacía) */}
        {!(esMovil && diasAgenda.length === 0) && <div style={{ flex: '1 1 560px', minWidth: 0, background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {esMovil ? agenda : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--border-subtle)' }}>
                {DIAS_SEMANA.map(d => (
                  <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', opacity: loading ? 0.5 : 1 }}>
                {dias.map(celda)}
              </div>
            </>
          )}
        </div>}

        {/* Panel derecho: programar o crear (en móvil, hoja inferior: ver abajo) */}
        {panelAbierto && !esMovil && (
          <div style={{ flex: '0 1 400px', minWidth: 300, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            {contenidoPanel}
          </div>
        )}
      </div>

      {panelAbierto && esMovil && <HojaInferior onCerrar={cerrarPanel}>{contenidoPanel}</HojaInferior>}

      {!loading && postsVisibles.length === 0 && !creando && (
        <p style={{ ...textoSecundario, marginTop: 12 }}>No hay posts{filtroRed !== 'todas' ? ` de ${FILTROS_RED.find(f => f.id === filtroRed).label}` : conHuecos ? '' : ' de Instagram ni TikTok'} {semanal ? 'esta semana' : `en ${MESES[ref.getMonth()]}`}. Pulsa el + de un día{conHuecos ? ' o un hueco sugerido' : ''} para crear uno.</p>
      )}
    </>
  )
}
