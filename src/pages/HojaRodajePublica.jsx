import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Clock, Link2Off, Check, MapPin, Phone, CalendarDays, Scissors, Clapperboard,
  Video, Images, Music, Lightbulb, Megaphone, MessageSquareWarning, CheckCircle2, Printer, Copy, StickyNote,
} from 'lucide-react'
import TablaPlanos from '../components/TablaPlanos'
import { esCarrusel } from '../utils/formato'
import { getHojaRodajePublica, marcarGrabadoPublico } from '../hooks/useHojaRodajeEnlace'

// Hoja de rodaje pública (/rodaje/<token>): la abre quien graba (el cliente,
// el cámara, el equipo) desde el enlace que comparte el gestor, sin cuenta.
// El token de la URL es la autenticación (ver 0035_hoja_rodaje_enlace.sql).
// A diferencia de la hoja de la app (por tipo de plano), aquí va vídeo a
// vídeo, con todo lo necesario para grabar cada uno sin abrir nada más.
// "Grabado" se marca por vídeo y se guarda en el post (0036): lo ve también
// la hoja de rodaje de la app, con todos los planos de ese vídeo marcados.
// Sin textos que mencionen la IA.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const REDES = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}

const fechaLarga = (s) => {
  if (!s) return ''
  const t = new Date(`${s}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
// "60s", "45-60 s", "1 min" → segundos (el primer número; "min" multiplica)
const segundosDe = (txt) => {
  const m = String(txt || '').match(/(\d+)/)
  if (!m) return null
  return /min/i.test(txt) ? Number(m[1]) * 60 : Number(m[1])
}
const duracionTexto = (seg) => (seg >= 60 ? `${Math.floor(seg / 60)} min${seg % 60 ? ` ${seg % 60} s` : ''}` : `${seg} s`)
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null)

// Lo que se dice, en orden, listo para leer o para el teleprompter
function textoCompleto(g) {
  const partes = [
    g.gancho, g.problema?.texto, g.promesa?.texto, ...(g.contenido?.frases || []),
    g.cierre?.remate, g.cierre?.cta,
  ].filter(Boolean)
  if (partes.length > 1) return partes
  return (g.planos || []).map(p => p.dice).filter(Boolean)
}

// "2 × Primer plano · 1 × Detalle"
function resumenPlanos(planos = []) {
  const cuenta = new Map()
  planos.forEach(p => { const k = (p.plano || 'Plano').trim(); cuenta.set(k, (cuenta.get(k) || 0) + 1) })
  return [...cuenta.entries()].map(([k, n]) => `${n} × ${k}`)
}

function StateMessage({ icon: Icon, iconColor, title, text }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gradient-bg)', padding: '40px 20px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 20, padding: '36px 28px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', border: '1px solid var(--border-subtle)', textAlign: 'center', boxSizing: 'border-box' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, margin: '0 auto 18px', background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={26} color={iconColor} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  )
}

function Dato({ icon: Icon, label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color="#1D5FE0" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children}</div>
      </div>
    </div>
  )
}

function Seccion({ icon: Icon, label, color = 'var(--text-secondary)', children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {Icon && <Icon size={13} />} {label}
      </div>
      {children}
    </div>
  )
}

const chip = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '3px 9px',
  borderRadius: 20, color, background: `${color}14`, whiteSpace: 'nowrap',
})

function TarjetaVideo({ post, numero, total, grabado, onToggle }) {
  const g = post.guion || {}
  const carrusel = esCarrusel(post)
  const planos = g.planos || []
  const texto = carrusel ? [] : textoCompleto(g)
  const seg = segundosDe(g.duracion_total)
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard?.writeText(texto.join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) }).catch(() => {})
  }
  const publicacion = post.en_calendario === false ? 'Sin fecha todavía' : `${fechaLarga(post.fecha)}${post.hora ? `, ${String(post.hora).slice(0, 5)}` : ''}`

  return (
    <article id={`pieza-${post.id}`} className="hoja-tarjeta" style={{
      background: 'var(--bg-card)', borderRadius: 18, border: `1px solid ${grabado ? 'rgba(48,209,88,0.35)' : 'var(--border-subtle)'}`,
      boxShadow: '0 2px 16px rgba(0,0,0,0.05)', padding: '18px 18px 20px', scrollMarginTop: 16,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>
            {carrusel ? 'Carrusel' : 'Vídeo'} {numero} de {total}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0, textDecoration: grabado ? 'line-through' : 'none' }}>
            {post.titulo || (carrusel ? 'Carrusel sin título' : 'Vídeo sin título')}
          </h2>
        </div>
        <button onClick={onToggle} className="no-print" role="checkbox" aria-checked={grabado}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 11, flexShrink: 0, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            border: grabado ? 'none' : '1.5px solid var(--border-color)', background: grabado ? '#30D158' : 'var(--bg-card)', color: grabado ? 'white' : 'var(--text-primary)',
          }}>
          <Check size={14} strokeWidth={3} /> {grabado ? (carrusel ? 'Hecho' : 'Grabado') : (carrusel ? 'Marcar hecho' : 'Marcar grabado')}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <span style={chip(carrusel ? '#1D5FE0' : '#FF2D55')}>{carrusel ? <Images size={12} /> : <Video size={12} />} {carrusel ? 'Carrusel' : 'Vídeo'}</span>
        {post.red && <span style={chip('#86868B')}>{REDES[post.red] || post.red}</span>}
        {!carrusel && seg && <span style={chip('#86868B')}><Clock size={12} /> {duracionTexto(seg)}</span>}
        {planos.length > 0 && <span style={chip('#86868B')}>{planos.length} {carrusel ? (planos.length === 1 ? 'slide' : 'slides') : (planos.length === 1 ? 'plano' : 'planos')}</span>}
        <span style={chip('#86868B')}><CalendarDays size={12} /> Se publica: {publicacion}</span>
        {post.aprobacion_estado === 'aprobado' && <span style={chip('#30D158')}><CheckCircle2 size={12} /> Aprobado por el cliente</span>}
        {post.aprobacion_estado === 'cambios' && <span style={chip('#FF9500')}><MessageSquareWarning size={12} /> Con cambios pedidos</span>}
      </div>

      {post.aprobacion_comentario && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FF9500', marginBottom: 2 }}>LO QUE PIDIÓ EL CLIENTE</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{post.aprobacion_comentario}</div>
        </div>
      )}

      {post.concepto && (
        <Seccion label="De qué va">
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>{post.concepto}</p>
        </Seccion>
      )}

      {g.gancho && (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(29,95,224,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1D5FE0', marginBottom: 3 }}>{carrusel ? 'PORTADA' : 'PRIMERA FRASE (0-3 S)'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{g.gancho}</div>
        </div>
      )}

      {!carrusel && texto.length > 0 && (
        <Seccion label="Texto completo que se dice">
          <div style={{ position: 'relative', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)' }}>
            {texto.map((t, i) => (
              <p key={i} style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6, margin: i ? '6px 0 0' : 0 }}>{t}</p>
            ))}
            <button onClick={copiar} className="no-print"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: copiado ? '#30D158' : 'var(--text-primary)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar texto (teleprompter)'}
            </button>
          </div>
        </Seccion>
      )}

      {planos.length > 0 ? (
        <Seccion label={carrusel ? 'Slides: texto y foto de cada una' : `Planos en orden${planos.length > 1 ? ` · ${resumenPlanos(planos).join(' · ')}` : ''}`}>
          <TablaPlanos planos={planos} carrusel={carrusel} />
        </Seccion>
      ) : !carrusel && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '14px 0 0' }}>Este guion no tiene planos: se graba a cámara siguiendo el texto.</p>
      )}

      {!carrusel && (g.cierre?.cta || g.audio_sugerido || g.tip_viral || g.contenido?.loopAbierto) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
          {g.cierre?.cta && <Dato icon={Megaphone} label="Llamada a la acción">{g.cierre.cta}</Dato>}
          {g.audio_sugerido && <Dato icon={Music} label="Música / audio">{g.audio_sugerido}</Dato>}
          {g.contenido?.loopAbierto && <Dato icon={Clapperboard} label="Pregunta que se deja abierta">{g.contenido.loopAbierto}</Dato>}
          {g.tip_viral && <Dato icon={Lightbulb} label="Consejo para grabarlo">{g.tip_viral}</Dato>}
        </div>
      )}

      {post.notas && (
        <Seccion icon={StickyNote} label="Notas">
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{post.notas}</p>
        </Seccion>
      )}
    </article>
  )
}

function leerGrabados(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || '{}') || {} } catch { return {} }
}

export default function HojaRodajePublica() {
  // Montado fuera de <Routes> (ver App.jsx), así que el token sale de la URL
  const token = window.location.pathname.split('/rodaje/')[1]?.split(/[/?#]/)[0] || null
  const [loading, setLoading] = useState(!!token)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(token ? null : 'Enlace no encontrado')
  const clave = `aify_rodaje_${token}`
  const [grabados, setGrabados] = useState(() => leerGrabados(clave))

  useEffect(() => {
    // Datos del negocio de alguien: no deben indexarse
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) return
    getHojaRodajePublica(token).then(async ({ data: d, error }) => {
      if (cancelled) return
      if (error) setLoadError(error.message || 'Enlace no encontrado')
      else {
        setData(d)
        // "Grabado" vive en el post (0036) y lo comparte con la app. Las marcas
        // que este navegador hizo antes de eso se suben una vez al abrir.
        const posts = d?.posts || []
        if (posts.length && 'grabado_en' in posts[0]) {
          const locales = leerGrabados(clave)
          const delServidor = Object.fromEntries(posts.filter(p => p.grabado_en).map(p => [p.id, true]))
          const pendientes = posts.filter(p => locales[p.id] && !p.grabado_en).map(p => p.id)
          setGrabados({ ...delServidor, ...Object.fromEntries(pendientes.map(id => [id, true])) })
          for (const id of pendientes) await marcarGrabadoPublico(token, id, true)
          try { localStorage.removeItem(clave) } catch { /* sin almacenamiento */ }
        }
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token, clave])

  const toggle = async (id) => {
    const grabado = !grabados[id]
    const siguiente = { ...grabados }
    if (grabado) siguiente[id] = true
    else delete siguiente[id]
    setGrabados(siguiente)
    const { error } = await marcarGrabadoPublico(token, id, grabado)
    // Sin la migración 0036 (o sin conexión) se queda en este navegador, como antes
    if (error) {
      try { localStorage.setItem(clave, JSON.stringify(siguiente)) } catch { /* sin almacenamiento: dura hasta recargar */ }
    }
  }

  const agencia = data?.agencia_nombre || 'tu equipo de contenido'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gradient-bg)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(0,0,0,0.1)', borderTopColor: '#1D5FE0' }} />
      </div>
    )
  }
  if (loadError || !data) {
    return <StateMessage icon={AlertTriangle} iconColor="#FF9500" title="No encontramos esta hoja de rodaje"
      text="Revisa que el enlace esté completo o pide uno nuevo a quien te lo envió." />
  }
  if (data.estado === 'revocado') {
    return <StateMessage icon={Link2Off} iconColor="#86868B" title="Este enlace ya no está activo" text={`Pide uno nuevo a ${agencia}.`} />
  }
  if (data.expirado) {
    return <StateMessage icon={Clock} iconColor="#86868B" title="Este enlace ha caducado" text={`Pide uno nuevo a ${agencia}.`} />
  }

  const posts = data.posts || []
  const videos = posts.filter(p => !esCarrusel(p))
  const carruseles = posts.filter(esCarrusel)
  const mes = MESES[(data.mes || 1) - 1]
  const diasGrabacion = (data.fechas || []).filter(f => f.titulo === 'Día de grabación').map(f => f.fecha)
  const diasEdicion = (data.fechas || []).filter(f => f.titulo === 'Edición').map(f => f.fecha)
  const totalPlanos = videos.reduce((s, p) => s + (p.guion?.planos?.length || 0), 0)
  const totalSeg = videos.reduce((s, p) => s + (segundosDe(p.guion?.duracion_total) || 0), 0)
  const hechos = posts.filter(p => grabados[p.id]).length
  const maps = urlSegura(data.google_maps)
  const tel = String(data.contacto_telefono || '').replace(/[^\d+]/g, '')

  return (
    // #root es display:flex (layout de la app): sin flex/width este contenedor se encoge
    <div className="hoja-rodaje" style={{ flex: 1, width: '100%', background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .hoja-rodaje { background: #fff !important; }
          .hoja-tarjeta { break-inside: avoid-page; box-shadow: none !important; }
        }
      `}</style>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{agencia}</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: '0 0 6px' }}>Hoja de rodaje</h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>
              {data.cliente_nombre} · <span style={{ textTransform: 'capitalize' }}>{mes}</span> {data.anio}
            </p>
          </div>
          <button onClick={() => window.print()} className="no-print"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>

        {/* Datos del día */}
        <div style={{ marginTop: 20, background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Dato icon={Clapperboard} label="Día de grabación">
            {diasGrabacion.length ? diasGrabacion.map(fechaLarga).join(' · ') : 'Por fijar'}
          </Dato>
          {diasEdicion.length > 0 && <Dato icon={Scissors} label="Edición">{diasEdicion.map(fechaLarga).join(' · ')}</Dato>}
          {(data.ubicacion || maps) && (
            <Dato icon={MapPin} label="Dónde">
              {data.ubicacion || 'Ver en el mapa'}
              {maps && <> · <a href={maps} target="_blank" rel="noopener noreferrer" style={{ color: '#1D5FE0', fontWeight: 600 }}>Abrir en Maps</a></>}
            </Dato>
          )}
          {(data.contacto_nombre || tel) && (
            <Dato icon={Phone} label="Contacto en el local">
              {data.contacto_nombre}{data.contacto_nombre && tel ? ' · ' : ''}
              {tel && <a href={`tel:${tel}`} style={{ color: '#1D5FE0', fontWeight: 600 }}>{data.contacto_telefono}</a>}
            </Dato>
          )}
          <Dato icon={Video} label="Qué se graba">
            {videos.length} {videos.length === 1 ? 'vídeo' : 'vídeos'}{totalPlanos ? ` · ${totalPlanos} planos` : ''}{totalSeg ? ` · ${duracionTexto(totalSeg)} de vídeo final` : ''}
            {carruseles.length > 0 && ` · ${carruseles.length} ${carruseles.length === 1 ? 'carrusel' : 'carruseles'}`}
          </Dato>
        </div>

        {data.notas && (
          <div style={{ marginTop: 12, background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Material y notas del día</div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{data.notas}</p>
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ marginTop: 16, background: 'var(--bg-card)', borderRadius: 18, padding: '28px 22px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <Clock size={24} color="#1D5FE0" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Todavía no hay nada que grabar</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {data.solo_aprobados ? 'Aquí aparecen los guiones cuando el cliente los aprueba.' : `${agencia} está preparando los guiones de ${mes}.`} Vuelve a abrir este enlace más adelante.
            </p>
          </div>
        ) : (
          <>
            {/* Progreso + índice */}
            <div className="no-print" style={{ marginTop: 16, background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>{hechos} de {posts.length} hechos</span>
                {hechos === posts.length && <span style={{ color: '#30D158', fontWeight: 600 }}>Todo grabado</span>}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 12 }}>
                <motion.div initial={false} animate={{ width: `${(hechos / posts.length) * 100}%` }} style={{ width: 0, height: '100%', background: '#30D158', borderRadius: 3 }} />
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...videos, ...carruseles].map((p, i) => (
                  <li key={p.id} style={{ fontSize: 14, color: grabados[p.id] ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    <span style={{ display: 'inline-block', width: 22, color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}.</span>
                    <a href={`#pieza-${p.id}`} style={{ color: 'inherit', textDecoration: grabados[p.id] ? 'line-through' : 'none' }}>
                      {p.titulo || (esCarrusel(p) ? 'Carrusel sin título' : 'Vídeo sin título')}
                    </a>
                    {esCarrusel(p) && <span style={{ color: 'var(--text-tertiary)' }}> · carrusel</span>}
                  </li>
                ))}
              </ol>
            </div>

            {videos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                {videos.map((p, i) => (
                  <TarjetaVideo key={p.id} post={p} numero={i + 1} total={videos.length} grabado={!!grabados[p.id]} onToggle={() => toggle(p.id)} />
                ))}
              </div>
            )}
            {carruseles.length > 0 && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '28px 0 4px' }}>Carruseles</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px' }}>Las fotos que hay que hacer para cada slide.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {carruseles.map((p, i) => (
                    <TarjetaVideo key={p.id} post={p} numero={i + 1} total={carruseles.length} grabado={!!grabados[p.id]} onToggle={() => toggle(p.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
