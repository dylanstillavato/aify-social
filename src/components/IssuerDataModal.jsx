import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Building2 } from 'lucide-react'

const LS_KEY = 'aify_datos_emisor'

export function getDatosEmisor() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s !== null ? JSON.parse(s) : null
  } catch { return null }
}

export function guardarDatosEmisor(datos) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(datos))
  } catch { /* ignore */ }
}

// Centered modal (backdrop + panel, framer-motion) matching ClienteDetalle's
// edit-panel visual style — collects the issuer's fiscal data once and
// remembers it in localStorage so every new factura/presupuesto can embed a
// frozen `emisor` snapshot without asking again.
export default function IssuerDataModal({ open, onClose, onSaved }) {
  const existentes = getDatosEmisor() || {}
  const [nombre, setNombre] = useState(existentes.nombre || '')
  const [nif, setNif] = useState(existentes.nif || '')
  const [direccion, setDireccion] = useState(existentes.direccion || '')
  const [error, setError] = useState(null)

  const handleGuardar = () => {
    if (!nombre.trim() || !nif.trim()) {
      setError('Nombre/razón social y NIF/CIF son obligatorios')
      return
    }
    const datos = { nombre: nombre.trim(), nif: nif.trim(), direccion: direccion.trim() }
    guardarDatosEmisor(datos)
    onSaved?.(datos)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: 14,
    color: 'var(--text-primary)', background: 'var(--bg-secondary)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', padding: 20,
            }}
          >
            <div
              style={{
                pointerEvents: 'auto', width: '100%', maxWidth: 440,
                background: 'var(--bg-card)', borderRadius: 18,
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '22px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: 'rgba(0,113,227,0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Building2 size={16} color="#0071E3" />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Tus datos fiscales
                    </h3>
                  </div>
                  {onClose && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} color="var(--text-primary)" />
                    </motion.button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 0 20px' }}>
                  Se usarán como emisor en tus facturas y presupuestos. Se guardan en este navegador — puedes editarlas cuando quieras.
                </p>
              </div>

              <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre / razón social</label>
                  <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Estudio Creativo SL" />
                </div>
                <div>
                  <label style={labelStyle}>NIF / CIF</label>
                  <input style={inputStyle} value={nif} onChange={e => setNif(e.target.value)} placeholder="Ej: B12345678" />
                </div>
                <div>
                  <label style={labelStyle}>Dirección</label>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    rows={2} value={direccion} onChange={e => setDireccion(e.target.value)}
                    placeholder="Ej: Calle Mayor 1, 28001 Madrid"
                  />
                </div>
                {error && (
                  <p style={{ fontSize: 12, color: '#FF3B30', margin: 0 }}>{error}</p>
                )}
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', gap: 10 }}>
                {onClose && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
                    style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                    Cancelar
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleGuardar}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--accent-blue)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  Guardar datos
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
