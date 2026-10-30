import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Clock, Link2Off, MessageSquareWarning, ChevronDown } from 'lucide-react'
import TablaPlanos from '../components/TablaPlanos'
import HistoriaCincoLineas from '../components/HistoriaCincoLineas'
import { esCarrusel } from '../utils/formato'
import { getAprobacionPublica, responderGuion } from '../hooks/useAprobaciones'

// Aprobación pública de los guiones del mes (/aprobar/<token>): la abre el
// cliente del gestor desde el enlace que le mandan, sin cuenta de Aify. El
// token de la URL es la autenticación (ver 0019_aprobacion_guiones.sql), igual
// que en FormularioCliente.jsx. Sin textos que mencionen la IA: para el
// cliente, estos guiones los ha preparado su equipo de contenido.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function StateMessage({ icon: Icon, iconColor, title, text }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--gradient-bg)', padding: '40px 20px', boxSizing: 'border-box',
    }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{
        width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 20, padding: '36px 28px 32px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.1)', border: '1px solid var(--border-subtle)', textAlign: 'center', boxSizing: 'border-box',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18, margin: '0 auto 18px',
          background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={26} color={iconColor} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
      </motion.div>
    </div>
  )
}

// Guion sin planos (generado antes de que existieran): se enseña el texto por secciones
function TextoGuion({ guion }) {
  const bloques = [
    ['Problema', guion.problema?.texto],
    ['Promesa', guion.promesa?.texto],
    ['Desarrollo', (guion.contenido?.frases || []).join(' ')],
    ['Cierre', [guion.cierre?.remate, guion.cierre?.cta].filter(Boolean).join(' ')],
  ].filter(([, t]) => t)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bloques.map(([label, texto]) => (
        <div key={label}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{texto}</div>
        </div>
      ))}
    </div>
  )
}

function TarjetaGuion({ post, token, onRespondido }) {
  const [abierto, setAbierto] = useState(!post.aprobacion_estado)
  const [pidiendo, setPidiendo] = useState(false)
  const [comentario, setComentario] = useState(post.aprobacion_comentario || '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const g = post.guion || {}
  const carrusel = esCarrusel(post)
  const estado = post.aprobacion_estado
  const fechaLarga = new Date(`${post.fecha}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  // solo la primera letra en mayúscula ("Martes, 22 de septiembre"), no cada palabra
  // en_calendario false (0030): guion aún sin programar, su fecha es solo el día 1 del mes
  const fecha = post.en_calendario === false ? 'Sin fecha de publicación todavía' : fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)

  const responder = async (nuevo) => {
    setEnviando(true); setError(null)
    const { error: err } = await responderGuion(token, post.id, nuevo, nuevo === 'cambios' ? comentario : null)
    setEnviando(false)
    if (err) { setError(err.message || 'No se pudo guardar tu respuesta. Inténtalo de nuevo.'); return }
    setPidiendo(false); setAbierto(false)
    onRespondido(post.id, nuevo, nuevo === 'cambios' ? comentario.trim() : null)
  }

  const btn = (color, filled) => ({
    flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
    cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.6 : 1,
    border: filled ? 'none' : `1.5px solid ${color}40`, background: filled ? color : 'var(--bg-card)', color: filled ? 'white' : color,
  })

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div onClick={() => setAbierto(a => !a)} style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>{fecha}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{post.titulo || (carrusel ? 'Carrusel' : 'Vídeo')}</div>
        </div>
        {estado === 'aprobado' && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#30D158', flexShrink: 0 }}><CheckCircle2 size={14} /> Aprobado</span>}
        {estado === 'cambios' && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#FF9500', flexShrink: 0 }}><MessageSquareWarning size={14} /> Cambios pedidos</span>}
        <ChevronDown size={16} color="#86868B" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 2 }} />
      </div>

      {abierto && (
        <div style={{ padding: '0 18px 18px' }}>
          <HistoriaCincoLineas historia={g.historia} paraCliente />
          {g.gancho && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(29,95,224,0.06)', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D5FE0', marginBottom: 3 }}>{g.sinTexto ? (carrusel ? 'PRIMERA FOTO' : 'PRIMERA IMAGEN') : carrusel ? 'PORTADA DEL CARRUSEL' : 'LO PRIMERO QUE SE OYE'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{g.gancho}</div>
            </div>
          )}
          {g.planos?.length ? <TablaPlanos planos={g.planos} carrusel={carrusel} sinTexto={!!g.sinTexto} /> : <TextoGuion guion={g} />}

          <div style={{ marginTop: 16 }}>
            {pidiendo ? (
              <>
                <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} maxLength={2000} autoFocus
                  placeholder="¿Qué cambiarías? Por ejemplo: el gancho no me convence, prefiero grabarlo en la tienda..."
                  style={{
                    width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border-color)',
                    fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none',
                    fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 10,
                  }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => responder('cambios')} disabled={enviando || !comentario.trim()} style={{ ...btn('#FF9500', true), opacity: (enviando || !comentario.trim()) ? 0.5 : 1 }}>
                    {enviando ? 'Enviando...' : 'Enviar cambios'}
                  </button>
                  <button onClick={() => setPidiendo(false)} style={btn('#86868B', false)}>Cancelar</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {estado !== 'aprobado' && (
                  <button onClick={() => responder('aprobado')} disabled={enviando} style={btn('#30D158', true)}>
                    <CheckCircle2 size={16} /> Aprobar
                  </button>
                )}
                <button onClick={() => setPidiendo(true)} disabled={enviando} style={btn('#FF9500', false)}>
                  <MessageSquareWarning size={16} /> {estado === 'cambios' ? 'Editar lo que pedí' : 'Pedir cambios'}
                </button>
              </div>
            )}
            {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AprobarGuiones() {
  // Montado fuera de <Routes> (ver App.jsx), así que el token sale de la URL
  const token = window.location.pathname.split('/aprobar/')[1]?.split(/[/?#]/)[0] || null
  const [loading, setLoading] = useState(!!token)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(token ? null : 'Enlace no encontrado')

  useEffect(() => {
    // Guiones del negocio de alguien: no deben indexarse
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) return
    getAprobacionPublica(token).then(({ data: d, error }) => {
      if (cancelled) return
      if (error) setLoadError(error.message || 'Enlace no encontrado')
      else setData(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

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
    return <StateMessage icon={AlertTriangle} iconColor="#FF9500" title="No encontramos estos guiones"
      text="Revisa que el enlace esté completo o pide uno nuevo a quien te lo envió." />
  }
  if (data.estado === 'revocado') {
    return <StateMessage icon={Link2Off} iconColor="#86868B" title="Este enlace ya no está activo" text={`Pide uno nuevo a ${agencia}.`} />
  }
  if (data.expirado) {
    return <StateMessage icon={Clock} iconColor="#86868B" title="Este enlace ha caducado" text={`Pide uno nuevo a ${agencia}.`} />
  }

  const posts = data.posts || []
  const mes = MESES[(data.mes || 1) - 1]
  const revisados = posts.filter(p => p.aprobacion_estado).length
  const todosRevisados = posts.length > 0 && revisados === posts.length

  const onRespondido = (id, estado, comentario) => {
    setData(d => ({
      ...d,
      posts: d.posts.map(p => p.id === id ? { ...p, aprobacion_estado: estado, aprobacion_comentario: comentario } : p),
    }))
  }

  return (
    // #root es display:flex (layout de la app): sin flex/width este contenedor se encoge
    <div style={{ flex: 1, width: '100%', background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px 60px', boxSizing: 'border-box' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
          {agencia}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Tus guiones de {mes}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' }}>
          {data.cliente_nombre ? `Hola, ${data.cliente_nombre}. ` : ''}Estos son los vídeos que vamos a grabar este mes. Revisa cada uno: apruébalo tal cual o dinos qué cambiarías.
        </p>

        {posts.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>{revisados} de {posts.length} revisados</span>
              {todosRevisados && <span style={{ color: '#30D158', fontWeight: 600 }}>Todo revisado. Gracias.</span>}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <motion.div animate={{ width: `${(revisados / posts.length) * 100}%` }} style={{ height: '100%', background: '#30D158', borderRadius: 3 }} />
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: 18, padding: '28px 22px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <Clock size={24} color="#1D5FE0" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Todavía no hay guiones</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {agencia} está preparando los guiones de {mes}. Vuelve a abrir este enlace en unos días.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map(p => <TarjetaGuion key={p.id} post={p} token={token} onRespondido={onRespondido} />)}
          </div>
        )}
      </div>
    </div>
  )
}
