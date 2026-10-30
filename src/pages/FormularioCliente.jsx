import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Clock, Link2Off } from 'lucide-react'
import NuevoCliente from './NuevoCliente'
import { getOnboardingPublico, enviarOnboarding } from '../hooks/useOnboardings'

// Formulario público de onboarding (/formulario/<token>): lo abre el cliente
// del gestor desde el enlace que le mandan, sin cuenta de Aify. Reutiliza el
// mismo cuestionario de "Nuevo cliente" en modo externo. El token de la URL es
// la autenticación (ver 0018_onboarding_externo.sql), igual que en
// FirmarPresupuesto.jsx.

function StateMessage({ icon: Icon, iconColor, title, text }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--gradient-bg)', padding: '40px 20px', boxSizing: 'border-box',
    }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{
        width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 20, padding: '36px 36px 32px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.1)', border: '1px solid var(--border-subtle)', textAlign: 'center',
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

export default function FormularioCliente() {
  // Montado fuera de <Routes> (ver App.jsx), así que el token sale de la URL
  const token = window.location.pathname.split('/formulario/')[1]?.split(/[/?#]/)[0] || null
  const [loading, setLoading] = useState(!!token)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(token ? null : 'Formulario no encontrado')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    // Un formulario con datos del negocio no debe indexarse
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) return
    getOnboardingPublico(token).then(({ data: d, error }) => {
      if (cancelled) return
      if (error) setLoadError(error.message || 'Formulario no encontrado')
      else setData(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  const agencia = data?.agencia_nombre || 'tu agencia'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gradient-bg)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(0,0,0,0.1)', borderTopColor: '#1D5FE0' }} />
      </div>
    )
  }
  if (loadError || !data) {
    return <StateMessage icon={AlertTriangle} iconColor="#FF9500" title="No encontramos este formulario"
      text="Revisa que el enlace esté completo o pide uno nuevo a quien te lo envió." />
  }
  if (enviado || data.estado === 'completado') {
    return <StateMessage icon={CheckCircle2} iconColor="#30D158" title="Listo. Ya tenemos todo lo que necesitamos."
      text={`${agencia} se pondrá en contacto contigo.`} />
  }
  if (data.estado === 'revocado') {
    return <StateMessage icon={Link2Off} iconColor="#86868B" title="Este enlace ya no está activo"
      text={`Pide uno nuevo a ${agencia}.`} />
  }
  if (data.expirado) {
    return <StateMessage icon={Clock} iconColor="#86868B" title="Este enlace ha caducado"
      text={`Pide uno nuevo a ${agencia}.`} />
  }

  const onEnviar = async (filaDB) => {
    const { error } = await enviarOnboarding(token, filaDB)
    if (!error) { setEnviado(true); window.scrollTo({ top: 0 }) }
    return { error }
  }

  return (
    // #root es display:flex (layout de la app): sin flex/width este contenedor
    // se encogía al ancho del contenido y el formulario quedaba pegado a la izquierda
    <div style={{ flex: 1, width: '100%', background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 40px 0', boxSizing: 'border-box' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
          Formulario de {agencia}
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {data.nombre_cliente ? `Hola, ${data.nombre_cliente}. ` : ''}Cuéntanos sobre tu negocio. Con esto preparamos tu contenido. Tardas unos 10 minutos.
        </p>
      </div>
      {/* enlace para cliente nuevo con nombre puesto por el gestor: se prerrellena */}
      <NuevoCliente externo={{
        datosIniciales: data.cliente || (data.nombre_cliente ? { nombre: data.nombre_cliente } : null),
        onEnviar,
      }} />
    </div>
  )
}
