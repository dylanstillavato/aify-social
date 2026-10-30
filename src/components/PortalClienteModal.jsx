import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, MessageCircle, Link2Off, ExternalLink, LayoutGrid } from 'lucide-react'
import { crearOObtenerPortal, revocarPortal, usePortalCliente, urlPortal } from '../hooks/usePortalCliente'
import { useOrganizacion } from '../hooks/useOrganizacion'

function mensajeWhatsApp(url, nombre) {
  return `${nombre ? `Hola, ${nombre}. ` : 'Hola. '}Te dejo tu espacio con todo lo nuestro: lo que tienes pendiente de revisar o firmar y tus facturas. Guárdalo, siempre es el mismo enlace: ${url}`
}

// Modal del portal del cliente (ver usePortalCliente.js): un único enlace
// estable por cliente con todo lo que tiene pendiente y sus facturas. Mismo
// lenguaje visual que EnviarAprobacionModal.
export default function PortalClienteModal({ open, onClose, cliente }) {
  const { organizacion } = useOrganizacion()
  const { activo, loading, refetch } = usePortalCliente(open ? cliente?.id : null)
  const [creando, setCreando] = useState(false)
  const [revocando, setRevocando] = useState(false)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const url = activo ? urlPortal(activo.token) : null

  const cerrar = () => { setError(null); onClose?.() }

  const crear = async () => {
    setCreando(true); setError(null)
    const { error: err } = await crearOObtenerPortal({ clienteId: cliente.id, organizacionId: organizacion?.id })
    setCreando(false)
    if (err) { setError(err.message || 'No se pudo crear el enlace'); return }
    refetch()
  }

  const revocar = async () => {
    if (!activo) return
    setRevocando(true); setError(null)
    const { error: err } = await revocarPortal(activo.id)
    setRevocando(false)
    if (err) setError(err.message || 'No se pudo revocar el enlace')
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url) } catch { /* sin permiso de portapapeles */ }
    setCopiado(true); setTimeout(() => setCopiado(false), 1600)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: 13,
    color: 'var(--text-primary)', background: 'var(--bg-secondary)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const btn = (primary) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '11px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: primary ? 'none' : '1.5px solid var(--border-color)',
    background: primary ? '#1D5FE0' : 'var(--bg-secondary)', color: primary ? 'white' : 'var(--text-primary)',
    textDecoration: 'none', boxSizing: 'border-box',
  })
  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--text-secondary)', display: 'flex' }

  return (
    <AnimatePresence>
      {open && cliente && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={cerrar}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: 20 }}
          >
            <div onClick={e => e.stopPropagation()} style={{
              pointerEvents: 'auto', width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto',
              background: 'var(--bg-card)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)',
            }}>
              <div style={{ padding: '22px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LayoutGrid size={16} color="#1D5FE0" />
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Portal del cliente
                    </p>
                  </div>
                  <button onClick={cerrar} style={iconBtn}><X size={18} /></button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' }}>
                  {cliente.nombre} ve en un solo enlace, sin cuenta, lo que tiene pendiente (formulario, presupuestos por firmar, guiones por aprobar) y sus facturas. El enlace no caduca.
                </p>

                {loading ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Cargando...</p>
                ) : url ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input readOnly value={url} onFocus={e => e.target.select()} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={copiar} style={{ ...btn(true), flexShrink: 0 }}>
                        {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(url, cliente.nombre))}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ ...btn(false), flex: 1 }}>
                        <MessageCircle size={15} color="#30D158" /> Enviar por WhatsApp
                      </a>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btn(false), flexShrink: 0 }}>
                        <ExternalLink size={15} /> Abrir
                      </a>
                    </div>
                    <button onClick={revocar} disabled={revocando}
                      style={{ ...iconBtn, gap: 6, alignItems: 'center', fontSize: 12, fontFamily: 'inherit', marginTop: 12, padding: '4px 0', opacity: revocando ? 0.6 : 1 }}>
                      <Link2Off size={13} /> {revocando ? 'Revocando...' : 'Revocar enlace'}
                    </button>
                  </div>
                ) : (
                  <button onClick={crear} disabled={creando} style={{ ...btn(true), width: '100%', opacity: creando ? 0.6 : 1 }}>
                    <LayoutGrid size={15} /> {creando ? 'Creando enlace...' : 'Crear enlace del portal'}
                  </button>
                )}
                {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>{error}</p>}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
