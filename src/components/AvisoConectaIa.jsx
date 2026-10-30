import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { KeyRound, X } from 'lucide-react'
import { EVENTO_CONECTA_IA, RUTA_TU_IA } from '../services/claveIa'

// Aviso común de «Conecta tu IA»: cualquier botón de IA que recibe 402 con
// conectaIa (ver claveIa.js) lo enseña, con un botón a Configuración → Tu IA.
// Va montado una vez en App.jsx.
export default function AvisoConectaIa() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    const alAvisar = (e) => setMensaje(e.detail?.mensaje || 'Conecta tu IA en Configuración → Tu IA')
    window.addEventListener(EVENTO_CONECTA_IA, alAvisar)
    return () => window.removeEventListener(EVENTO_CONECTA_IA, alAvisar)
  }, [])

  // Ya en Configuración, el propio aviso sobra
  const visible = Boolean(mensaje) && location.pathname !== '/configuracion'

  const irATuIa = () => {
    setMensaje(null)
    navigate(RUTA_TU_IA)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', right: 20, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 2000,
            width: 'min(380px, calc(100vw - 40px))', boxSizing: 'border-box',
            background: 'var(--bg-card)', borderRadius: 16, padding: '16px 18px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.16)', border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <KeyRound size={16} color="#1D5FE0" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Conecta tu IA</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>
                {mensaje.replace(/\.$/, '')}. En Aify Social la IA la pones tú: tu clave de Claude o de Gemini, y lo que gaste lo paga tu cuenta.
              </div>
              <button type="button" onClick={irATuIa}
                style={{ marginTop: 12, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#1D5FE0', color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Ir a Tu IA
              </button>
            </div>
            <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)' }}>
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
