import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Link2Off, ClipboardList, PenLine, FileText, CheckCircle2, ChevronRight } from 'lucide-react'
import { getPortalPublico } from '../hooks/usePortalCliente'

// Portal público del cliente (/portal/<token>): un único enlace estable que el
// gestor le da a su cliente con todo lo que tiene pendiente (formulario,
// presupuestos por firmar, guiones por aprobar) y sus facturas, sin cuenta de
// Aify. El token de la URL es la autenticación (ver 0021_portal_cliente.sql),
// igual que en FormularioCliente.jsx y AprobarGuiones.jsx. Sin textos que
// mencionen la IA.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const formatoEur = (n) => eur.format(Number(n) || 0)

// Las fechas 'YYYY-MM-DD' se interpretan en local (new Date('2026-09-30') sería UTC)
function fechaLocal(iso) {
  if (!iso) return null
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}
const formatoFecha = (iso) => fechaLocal(iso)?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) || ''

const CHIPS = {
  pagada: { label: 'Pagada', color: '#30D158' },
  pendiente: { label: 'Pendiente', color: '#FF9500' },
  vencida: { label: 'Vencida', color: '#FF3B30' },
}

function estadoFactura(f) {
  if (f.estado === 'pagada') return 'pagada'
  if (f.estado === 'vencida') return 'vencida'
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = fechaLocal(f.fecha_vencimiento)
  if (vence && vence < hoy) return 'vencida'
  return 'pendiente'
}

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

function TarjetaAccion({ href, icon: Icon, color, titulo, detalle }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px', borderRadius: 14,
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textDecoration: 'none',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={19} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>{titulo}</p>
        {detalle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{detalle}</p>}
      </div>
      <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
    </a>
  )
}

const tituloSeccion = {
  fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', margin: '0 0 10px',
}

export default function PortalCliente() {
  // Montado fuera de <Routes> (ver App.jsx), así que el token sale de la URL
  const token = window.location.pathname.split('/portal/')[1]?.split(/[/?#]/)[0] || null
  const [loading, setLoading] = useState(!!token)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(token ? null : 'Portal no encontrado')

  useEffect(() => {
    // Un portal con datos del cliente y sus facturas no debe indexarse
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) return
    getPortalPublico(token).then(({ data: d, error }) => {
      if (cancelled) return
      if (error) setLoadError(error.message || 'Portal no encontrado')
      else setData(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  const agencia = data?.agencia_nombre || 'tu agencia'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gradient-bg)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(0,0,0,0.1)', borderTopColor: '#1D5FE0' }} />
      </div>
    )
  }
  if (loadError || !data) {
    return <StateMessage icon={AlertTriangle} iconColor="#FF9500" title="No encontramos este enlace"
      text="Revisa que el enlace esté completo o pide uno nuevo a quien te lo envió." />
  }
  if (data.estado === 'revocado') {
    return <StateMessage icon={Link2Off} iconColor="#86868B" title="Este enlace ya no está activo"
      text={`Pide uno nuevo a ${agencia}.`} />
  }

  const cliente = data.cliente || {}
  const colorMarca = cliente.colores?.colorPrimario || '#1D5FE0'
  const formularios = data.formularios || []
  const presupuestos = data.presupuestos || []
  const aprobaciones = (data.aprobaciones || []).filter(a => a.total > 0)
  const facturas = data.facturas || []
  const hayPendientes = formularios.length + presupuestos.length + aprobaciones.length > 0

  return (
    // #root es display:flex (layout de la app): sin flex/width el contenedor se encoge
    <div style={{ flex: 1, width: '100%', background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 48px', boxSizing: 'border-box' }}>

        {/* Cabecera */}
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          {agencia}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          {cliente.logo && (
            <img src={cliente.logo} alt="" style={{
              width: 52, height: 52, borderRadius: 14, objectFit: 'contain', flexShrink: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            }} />
          )}
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.15, margin: 0 }}>
            Hola, {cliente.nombre || 'bienvenido'}
          </h1>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 28px' }}>
          Aquí tienes todo lo que tenemos en marcha contigo. Guarda este enlace: siempre es el mismo.
        </p>

        {/* Pendiente de ti */}
        <p style={tituloSeccion}>Pendiente de ti</p>
        {hayPendientes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {formularios.map(f => (
              <TarjetaAccion key={f.token} href={`/formulario/${f.token}`} icon={ClipboardList} color={colorMarca}
                titulo="Completa tu ficha" detalle="Cuéntanos sobre tu negocio. Unos 10 minutos." />
            ))}
            {presupuestos.map(p => (
              <TarjetaAccion key={p.token} href={`/firmar/${p.token}`} icon={PenLine} color={colorMarca}
                titulo={`Firma el presupuesto ${p.numero} · ${formatoEur(p.total)}`}
                detalle={p.validez_hasta ? `Válido hasta el ${formatoFecha(p.validez_hasta)}` : null} />
            ))}
            {aprobaciones.map(a => (
              <TarjetaAccion key={a.token} href={`/aprobar/${a.token}`} icon={FileText} color={colorMarca}
                titulo={`Revisa los guiones de ${MESES[a.mes - 1]}`}
                detalle={a.pendientes > 0 ? `${a.pendientes} por revisar` : 'Todos revisados'} />
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 14, marginBottom: 32,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          }}>
            <CheckCircle2 size={20} color="#30D158" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              Todo al día. No tienes nada pendiente ahora mismo.
            </p>
          </div>
        )}

        {/* Tus facturas */}
        <p style={tituloSeccion}>Tus facturas</p>
        {facturas.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Todavía no hay facturas.</p>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
            {facturas.map((f, i) => {
              const chip = CHIPS[estadoFactura(f)]
              return (
                <div key={`${f.numero}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.numero}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{formatoFecha(f.fecha_emision)}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatoEur(f.total)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: chip.color, background: `${chip.color}18`, whiteSpace: 'nowrap' }}>{chip.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
