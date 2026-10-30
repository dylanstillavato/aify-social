import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, FileSignature, Download, AlertTriangle, ClipboardList } from 'lucide-react'
import { getPresupuestoPublico, firmarPresupuesto } from '../hooks/usePresupuestos'
import { exportarPresupuesto } from '../services/exportPDF'
import { supabase } from '../services/supabase'
import SignaturePad from '../components/SignaturePad'

function formatFecha(iso) {
  if (!iso) return '–'
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

function Wrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--gradient-bg)', padding: '40px 20px',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {children}
      </div>
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 20, padding: '36px 36px 32px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.1)', border: '1px solid var(--border-subtle)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function StateMessage({ icon: Icon, iconColor, title, text }) {
  return (
    <Wrapper>
      <Card style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18, margin: '0 auto 18px',
          background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={26} color={iconColor} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
      </Card>
    </Wrapper>
  )
}

export default function FirmarPresupuesto() {
  // Este componente se monta fuera de cualquier <Routes>/<Route> (ver App.jsx,
  // bloque `location.pathname.startsWith('/firmar/')`), así que useParams()
  // no tiene contexto de ruta del que leer y siempre devolvía undefined —
  // el enlace público de firma estaba roto por completo. Se extrae el token
  // directamente de la URL en su lugar.
  const token = window.location.pathname.split('/firmar/')[1]?.split(/[/?#]/)[0] || null
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [firmanteNombre, setFirmanteNombre] = useState('')
  const [firmanteEmail, setFirmanteEmail] = useState('')
  const [firmando, setFirmando] = useState(false)
  const [firmarError, setFirmarError] = useState(null)
  const [firmadoAhora, setFirmadoAhora] = useState(null) // { firmado_en } from a successful sign in this session
  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState(null)
  const sigRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!supabase) {
      // No Supabase configured in this environment at all — distinct from a
      // "this specific token is invalid" RPC error, so it gets its own copy.
      setLoading(false)
      return
    }
    setLoading(true)
    getPresupuestoPublico(token).then(({ data: res, error }) => {
      if (cancelled) return
      if (error || !res) {
        setLoadError(error || new Error('Presupuesto no encontrado'))
      } else {
        setData(res)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  const handleExportar = async () => {
    if (!data) return
    setExportando(true)
    setExportError(null)
    try {
      // getPresupuestoPublico's RPC returns snake_case keys (it's raw
      // Postgres jsonb) — exportarPresupuesto expects the same camelCase
      // shape usePresupuestos.js's mapearPresupuesto() produces internally.
      await exportarPresupuesto({ nombre: data.cliente_nombre }, {
        numero: data.numero,
        fechaEmision: data.fecha_emision,
        validezHasta: data.validez_hasta,
        estado: firmadoAhora ? 'firmado' : data.estado,
        items: data.items,
        subtotal: data.subtotal,
        ivaPct: data.iva_pct,
        iva: data.iva,
        total: data.total,
        ivaIncluido: !!data.iva_incluido,
        notas: data.notas,
        emisor: data.emisor,
        firmaDataUrl: firmadoAhora?.firmaDataUrl,
        firmadoEn: firmadoAhora?.firmado_en || data.firmado_en,
        firmanteNombre: firmadoAhora ? firmanteNombre : data.firmante_nombre,
      })
    } catch (e) {
      setExportError(e.message || 'No se pudo exportar el PDF')
    } finally {
      setExportando(false)
    }
  }

  const handleFirmar = async () => {
    setFirmarError(null)
    if (!firmanteNombre.trim()) { setFirmarError('Indica tu nombre'); return }
    if (sigRef.current?.isEmpty()) { setFirmarError('Dibuja tu firma antes de continuar'); return }
    setFirmando(true)
    try {
      const firmaDataUrl = sigRef.current.toDataURL()
      const { data: res, error } = await firmarPresupuesto(token, {
        firmaDataUrl, firmanteNombre: firmanteNombre.trim(), firmanteEmail: firmanteEmail.trim(),
      })
      if (error) throw error
      setFirmadoAhora({ firmado_en: res?.firmado_en || new Date().toISOString(), firmaDataUrl, onboardingToken: res?.onboarding_token || null })
    } catch (e) {
      setFirmarError(e.message || 'No se pudo registrar la firma. Intenta de nuevo.')
    } finally {
      setFirmando(false)
    }
  }

  if (loading) {
    return (
      <Wrapper>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid rgba(0,113,227,0.15)', borderTopColor: '#0071E3' }}
          />
        </div>
      </Wrapper>
    )
  }

  if (loadError) {
    // Never surface the raw RPC error text — could leak internal details.
    return (
      <StateMessage
        icon={AlertTriangle} iconColor="#FF3B30"
        title="Enlace no válido"
        text="Este enlace de presupuesto no existe o ya no está disponible. Comprueba que lo has copiado completo, o pide a la agencia que te envíe uno nuevo."
      />
    )
  }

  if (!data) {
    return (
      <StateMessage
        icon={AlertTriangle} iconColor="#FF3B30"
        title="Enlace no disponible en este entorno"
        text="No se ha podido conectar con el servicio de firmas. Inténtalo de nuevo más tarde."
      />
    )
  }

  const yaFirmado = data.estado === 'firmado' || firmadoAhora

  if (yaFirmado) {
    const nombreFirmante = firmadoAhora ? firmanteNombre : data.firmante_nombre
    const fechaFirma = firmadoAhora ? firmadoAhora.firmado_en : data.firmado_en
    // Siguiente paso (0047): el formulario de onboarding, si la agencia lo pidió
    const onboardingToken = firmadoAhora?.onboardingToken || data.onboarding_token || null
    return (
      <Wrapper>
        <Card style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 18px',
            background: 'rgba(48,209,88,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle2 size={26} color="#30D158" />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Presupuesto {data.numero} firmado
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Firmado por <strong style={{ color: 'var(--text-primary)' }}>{nombreFirmante || 'el cliente'}</strong> el {formatFecha(fechaFirma)}.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={handleExportar} disabled={exportando}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 auto',
              padding: '11px 22px', borderRadius: 11, background: 'var(--accent-blue)',
              color: 'white', border: 'none', cursor: exportando ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit', opacity: exportando ? 0.7 : 1,
            }}
          >
            <Download size={15} /> {exportando ? 'Exportando...' : 'Exportar PDF'}
          </motion.button>
          {exportError && <p style={{ fontSize: 12.5, color: '#FF3B30', marginTop: 12 }}>{exportError}</p>}
        </Card>
        {onboardingToken && (
          <Card style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, margin: '0 auto 14px',
              background: 'rgba(0,113,227,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ClipboardList size={22} color="#0071E3" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Siguiente paso: cuéntanos sobre tu negocio</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Un formulario de unos minutos para que podamos empezar a preparar tu contenido.
            </p>
            <a
              href={`/formulario/${onboardingToken}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 11,
                background: 'var(--accent-blue)', color: 'white', textDecoration: 'none',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              Rellenar el formulario
            </a>
          </Card>
        )}
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,113,227,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSignature size={17} color="#0071E3" />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Presupuesto {data.numero}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{data.cliente_nombre}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, margin: '16px 0 20px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <span>Emisión: {formatFecha(data.fecha_emision)}</span>
          {data.validez_hasta && <span>Válido hasta: {formatFecha(data.validez_hasta)}</span>}
        </div>

        {/* Line items */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px 80px', gap: 8, padding: '9px 14px', background: 'var(--bg-secondary)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Concepto</span><span style={{ textAlign: 'right' }}>Cant.</span><span style={{ textAlign: 'right' }}>Precio</span><span style={{ textAlign: 'right' }}>Subtotal</span>
          </div>
          {(data.items || []).map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px 80px', gap: 8, padding: '9px 14px', fontSize: 13, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{item.concepto}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.cantidad}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{Number(item.precio_unitario || 0).toFixed(2)} €</span>
              <span style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }}>{Number(item.subtotal || 0).toFixed(2)} €</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span>{data.iva_incluido ? 'Base imponible' : 'Subtotal'}</span><span>{Number(data.subtotal || 0).toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span>IVA ({data.iva_pct}%)</span><span>{Number(data.iva || 0).toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            <span>Total{data.iva_incluido ? ' (IVA incluido)' : ''}</span><span>{Number(data.total || 0).toFixed(2)} €</span>
          </div>
          {Number(data.cuota_mensual) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <span>Cuota mensual</span><span>{Number(data.cuota_mensual).toFixed(2)} € / mes</span>
            </div>
          )}
        </div>

        {data.notas && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{data.notas}</p>
        )}

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Firmar este presupuesto</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Tu nombre</label>
            <input
              value={firmanteNombre} onChange={e => setFirmanteNombre(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Email (opcional)</label>
            <input
              type="email" value={firmanteEmail} onChange={e => setFirmanteEmail(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <SignaturePad ref={sigRef} width={520} height={160} style={{ marginBottom: 14 }} />

        {firmarError && <p style={{ fontSize: 12.5, color: '#FF3B30', marginBottom: 12 }}>{firmarError}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }} onClick={handleFirmar} disabled={firmando}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, background: firmando ? 'var(--text-tertiary)' : 'var(--accent-blue)',
            border: 'none', cursor: firmando ? 'not-allowed' : 'pointer', fontSize: 14.5, fontWeight: 700,
            color: 'white', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {firmando ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Firmando...</>
          ) : 'Firmar el presupuesto'}
        </motion.button>

        <button
          onClick={handleExportar} disabled={exportando}
          style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: exportando ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}
        >
          <Download size={14} /> {exportando ? 'Exportando...' : 'Exportar PDF'}
        </button>
        {exportError && <p style={{ fontSize: 12.5, color: '#FF3B30', marginTop: 10 }}>{exportError}</p>}
      </Card>
    </Wrapper>
  )
}
