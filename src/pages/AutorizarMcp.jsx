import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plug, AlertCircle, LogIn, Check, Users, CalendarDays, PenLine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { verSolicitudOAuth, responderSolicitudOAuth } from '../services/oauthMcp'
import faviconIcon from '../assets/favicon-icon.png'

// Pantalla «Permitir» del OAuth del MCP de Aify (mcp/oauth.js, docs/mcp.md).
// claude.ai, Claude Desktop o ChatGPT mandan aquí al usuario cuando añade el
// conector de Aify: inicia sesión con su cuenta de Aify, ve qué app pide
// acceso y a qué sitio volverá, y pulsa «Permitir» o «Cancelar». El servidor
// devuelve la dirección de vuelta (con el código o con access_denied) y la
// página lleva allí al usuario. Igual que /invitacion/, funciona con y sin
// sesión: sin sesión, pide iniciar sesión y vuelve aquí.

const PERMISOS = [
  { icono: Users, texto: 'Ver tus clientes, sus ideas, guiones, calendario y métricas' },
  { icono: PenLine, texto: 'Crear ideas y posts, y leer y escribir tus pizarras de Aify Pictures' },
  { icono: CalendarDays, texto: 'Mover posts y programar publicaciones cuando se lo pidas' },
]

function Wrapper({ children }) {
  const { theme } = useTheme()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--gradient-bg)', padding: 16, boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          background: 'var(--bg-card)', borderRadius: 22, padding: '40px 36px',
          width: 440, maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 60px rgba(0,0,0,0.1), 0 2px 12px rgba(0,0,0,0.06)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
          <img src={faviconIcon} alt="Aify" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', lineHeight: 1 }}>Aify</span>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function Spinner({ claro }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{
        width: claro ? 18 : 26, height: claro ? 18 : 26, borderRadius: '50%',
        border: claro ? '2px solid rgba(255,255,255,0.35)' : '2.5px solid rgba(29,95,224,0.15)',
        borderTopColor: claro ? 'white' : 'var(--accent-blue)',
      }}
    />
  )
}

function Icono({ children, color = 'var(--accent-blue)', fondo = 'rgba(29,95,224,0.1)' }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 16, background: fondo, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
    }}>
      {children}
    </div>
  )
}

const boton = {
  width: '100%', height: 48, borderRadius: 12, fontSize: 15, fontWeight: 600, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
const botonPrincipal = { ...boton, background: 'var(--accent-blue)', color: 'white' }
const botonSecundario = { ...boton, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
const titulo = { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px', textAlign: 'center', lineHeight: 1.35 }
const parrafo = { fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px', lineHeight: 1.6, textAlign: 'center' }

export default function AutorizarMcp() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const solicitudId = new URLSearchParams(location.search).get('solicitud')

  const [solicitud, setSolicitud] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(null) // 'permitir' | 'cancelar'
  const [volviendo, setVolviendo] = useState(false)

  useEffect(() => {
    if (!user || !solicitudId) return
    let vivo = true
    verSolicitudOAuth(solicitudId)
      .then(data => { if (vivo) setSolicitud(data) })
      .catch(err => { if (vivo) setError(err.message) })
    return () => { vivo = false }
  }, [user, solicitudId])

  const responder = async (permitir) => {
    if (enviando) return
    setEnviando(permitir ? 'permitir' : 'cancelar')
    setError(null)
    try {
      const { redirigir_a } = await responderSolicitudOAuth(solicitudId, permitir)
      setVolviendo(permitir)
      window.location.assign(redirigir_a)
    } catch (err) {
      setError(err.message)
      setEnviando(null)
    }
  }

  if (!solicitudId) {
    return (
      <Wrapper>
        <Icono color="#FF3B30" fondo="rgba(255,59,48,0.1)"><AlertCircle size={26} /></Icono>
        <p style={titulo}>Enlace de conexión no válido</p>
        <p style={parrafo}>Vuelve a tu Claude o a tu ChatGPT y añade otra vez el conector de Aify.</p>
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/dashboard')} style={botonSecundario}>Ir a Aify</motion.button>
      </Wrapper>
    )
  }

  if (!user) {
    return (
      <Wrapper>
        <Icono><Plug size={26} /></Icono>
        <p style={titulo}>Inicia sesión para conectar tu IA con Aify</p>
        <p style={parrafo}>Usa tu cuenta de Aify. Después podrás elegir si le das acceso.</p>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login', { state: { returnTo: `/autorizar-mcp?solicitud=${encodeURIComponent(solicitudId)}` } })}
          style={botonPrincipal}
        >
          <LogIn size={16} /> Iniciar sesión
        </motion.button>
      </Wrapper>
    )
  }

  if (volviendo) {
    return (
      <Wrapper>
        <Icono color="#30D158" fondo="rgba(48,209,88,0.1)"><Check size={26} /></Icono>
        <p style={titulo}>Conectado</p>
        <p style={parrafo}>Volviendo a {solicitud?.sitio || 'tu IA'}…</p>
      </Wrapper>
    )
  }

  if (error && !solicitud) {
    return (
      <Wrapper>
        <Icono color="#FF3B30" fondo="rgba(255,59,48,0.1)"><AlertCircle size={26} /></Icono>
        <p style={titulo}>No se puede conectar</p>
        <p style={parrafo}>{error}</p>
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/dashboard')} style={botonSecundario}>Ir a Aify</motion.button>
      </Wrapper>
    )
  }

  if (!solicitud) {
    return (
      <Wrapper>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner /></div>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Icono><Plug size={26} /></Icono>
      <p style={titulo}>{solicitud.cliente} quiere acceder a tu organización de Aify</p>
      <p style={{ ...parrafo, marginBottom: 18 }}>
        {solicitud.organizacion ? <>Organización: <strong style={{ color: 'var(--text-primary)' }}>{solicitud.organizacion}</strong>. </> : null}
        Actuará en tu nombre y solo con lo que le pidas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
        {PERMISOS.map(({ icono: IconoPermiso, texto }) => (
          <div key={texto} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            <IconoPermiso size={16} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{texto}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.55, textAlign: 'center' }}>
        Al permitir, volverás a <strong style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{solicitud.sitio}</strong>.
        Puedes desconectarla cuando quieras en Configuración, Tu IA.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => responder(true)} disabled={!!enviando}
          style={{ ...botonPrincipal, cursor: enviando ? 'wait' : 'pointer', opacity: enviando === 'cancelar' ? 0.6 : 1 }}>
          {enviando === 'permitir' ? <Spinner claro /> : 'Permitir'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => responder(false)} disabled={!!enviando}
          style={{ ...botonSecundario, cursor: enviando ? 'wait' : 'pointer', opacity: enviando === 'permitir' ? 0.6 : 1 }}>
          {enviando === 'cancelar' ? 'Cancelando…' : 'Cancelar'}
        </motion.button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)',
          borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#FF3B30', textAlign: 'center', marginTop: 14,
        }}>
          {error}
        </div>
      )}
    </Wrapper>
  )
}
