import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Users, Zap, CheckCircle2, AlertCircle, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getInvitacionPublica, aceptarInvitacionOrganizacion } from '../hooks/useOrganizacion'

// Esta página se renderiza fuera del árbol normal de <Routes>/<Route> (igual que
// FirmarPresupuesto en /firmar/), así que useParams() no tiene contexto de ruta
// del que leer el token — lo extraemos directamente del pathname.
function extraerToken(pathname) {
  const m = pathname.match(/^\/invitacion\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'linear-gradient(135deg,#007BFF,#4DA3FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Zap size={16} color="white" />
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
        Aify
      </span>
    </div>
  )
}

function Wrapper({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-secondary)', padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          background: 'var(--bg-card)', borderRadius: 22, padding: '44px 40px',
          width: 440, maxWidth: 'calc(100vw - 32px)',
          boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box',
        }}
      >
        <Logo />
        {children}
      </motion.div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2.5px solid rgba(29,95,224,0.15)', borderTopColor: 'var(--accent-blue)',
        }}
      />
    </div>
  )
}

const primaryButtonStyle = {
  width: '100%', height: 48, borderRadius: 12,
  background: 'var(--accent-blue)', color: 'white',
  fontSize: 15, fontWeight: 600, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

export default function InvitacionOrganizacion() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const token = extraerToken(location.pathname)

  const [loading, setLoading] = useState(() => !!user && !!token)
  const [error, setError] = useState(null)
  const [invitacion, setInvitacion] = useState(null)
  const [aceptando, setAceptando] = useState(false)
  const [aceptarError, setAceptarError] = useState(null)

  useEffect(() => {
    if (!user || !token) return
    let cancelado = false
    getInvitacionPublica(token).then(({ data, error: err }) => {
      if (cancelado) return
      if (err || !data) {
        setError(err || 'Invitación no encontrada')
      } else if (data.usada) {
        setError('Esta invitación ya se usó')
      } else {
        setInvitacion(data)
      }
      setLoading(false)
    })
    return () => { cancelado = true }
  }, [user, token])

  const handleUnirme = async () => {
    if (!token || aceptando) return
    setAceptando(true)
    setAceptarError(null)
    try {
      const { data, error: err } = await aceptarInvitacionOrganizacion(token)
      if (err || !data?.ok) {
        setAceptarError(err || 'No se pudo aceptar la invitación')
        setAceptando(false)
        return
      }
      // Recarga completa (en vez de navigate) para que useOrganizacion() y el
      // resto de la app recojan la nueva membresía desde cero.
      window.location.href = '/dashboard'
    } catch (err) {
      setAceptarError(err.message || 'No se pudo aceptar la invitación')
      setAceptando(false)
    }
  }

  // Sin token válido en la URL
  if (!token) {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            Enlace de invitación no válido
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Este enlace parece estar incompleto o mal formado. Pide a quien te invitó que te lo reenvíe.
          </p>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/dashboard')} style={primaryButtonStyle}>
            Ir al panel
          </motion.button>
        </div>
      </Wrapper>
    )
  }

  // Sin sesión: pedir login, preservando el destino para volver aquí.
  if (!user) {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(29,95,224,0.1)', border: '2px solid rgba(29,95,224,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Users size={28} color="var(--accent-blue)" />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            Necesitas iniciar sesión para aceptar esta invitación
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Inicia sesión (o crea una cuenta) y vuelve a este enlace para unirte a la organización.
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/login', { state: { returnTo: `/invitacion/${token}` } })}
            style={primaryButtonStyle}
          >
            <LogIn size={16} /> Iniciar sesión
          </motion.button>
        </div>
      </Wrapper>
    )
  }

  // Con sesión: cargando la invitación
  if (loading) {
    return (
      <Wrapper>
        <Spinner />
      </Wrapper>
    )
  }

  // Con sesión: invitación inválida o ya usada
  if (error) {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,59,48,0.1)', border: '2px solid rgba(255,59,48,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <AlertCircle size={28} color="#FF3B30" />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            {error}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Pide a quien te invitó que te comparta un nuevo enlace.
          </p>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/dashboard')} style={primaryButtonStyle}>
            Ir al panel
          </motion.button>
        </div>
      </Wrapper>
    )
  }

  // Con sesión: invitación válida
  return (
    <Wrapper>
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(48,209,88,0.1)', border: '2px solid rgba(48,209,88,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Users size={28} color="#30D158" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          Te han invitado a unirte a {invitacion?.organizacion_nombre}
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          Al unirte pasarás a formar parte de esta organización y compartirás sus clientes.
        </p>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleUnirme}
          disabled={aceptando}
          style={{ ...primaryButtonStyle, background: 'var(--accent-lime)', color: '#0B0C10', cursor: aceptando ? 'not-allowed' : 'pointer', opacity: aceptando ? 0.8 : 1 }}
        >
          {aceptando ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(11,12,16,0.25)', borderTopColor: '#0B0C10' }}
            />
          ) : (
            <><CheckCircle2 size={16} /> Unirme</>
          )}
        </motion.button>

        {aceptarError && (
          <div style={{
            background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)',
            borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#FF3B30',
            textAlign: 'center', marginTop: 14,
          }}>
            {aceptarError}
          </div>
        )}
      </div>
    </Wrapper>
  )
}
