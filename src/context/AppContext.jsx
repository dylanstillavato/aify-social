import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HardDrive, X } from 'lucide-react'

const LS_CONTENIDO = 'aify_contenido'
const LS_ESTADOS = 'aify_estados'
const LS_ACTIVO = 'aify_cliente_activo'

function lsRead(key, fallback) {
  try {
    const s = localStorage.getItem(key)
    return s !== null ? JSON.parse(s) : fallback
  } catch { return fallback }
}

// El cliente activo se guarda como id en texto plano. Versiones anteriores lo
// guardaban unas veces con JSON.stringify ("\"abc\"" o 5) y otras en crudo
// (abc), así que la lectura acepta ambos formatos y descarta lo que no parezca
// un id (objetos, null, cadenas vacías...).
function parseClienteActivo(raw) {
  if (raw === null || raw === undefined) return null
  let v = String(raw).trim()
  if (!v) return null
  try {
    const parsed = JSON.parse(v)
    if (typeof parsed === 'string' || typeof parsed === 'number') v = String(parsed).trim()
    else return null
  } catch { /* id en crudo */ }
  if (!v || v === 'null' || v === 'undefined' || v.length > 200) return null
  return v
}

function readClienteActivo() {
  try { return parseClienteActivo(localStorage.getItem(LS_ACTIVO)) } catch { return null }
}

function lsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
    return false
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [contenido, setContenido] = useState(() => lsRead(LS_CONTENIDO, {}))
  const [estados, setEstados] = useState(() => lsRead(LS_ESTADOS, {}))
  const [clienteActivo, setClienteActivoState] = useState(readClienteActivo)
  const [storageFull, setStorageFull] = useState(false)
  const toastTimer = useRef(null)

  // Persist contenido to localStorage whenever it changes
  useEffect(() => {
    lsWrite(LS_CONTENIDO, contenido)
  }, [contenido])

  // Persist estados to localStorage whenever it changes
  useEffect(() => {
    lsWrite(LS_ESTADOS, estados)
  }, [estados])

  // Listen for storage full events from anywhere in the app
  useEffect(() => {
    const h = () => {
      setStorageFull(true)
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setStorageFull(false), 5000)
    }
    window.addEventListener('aify:storage_full', h)
    return () => window.removeEventListener('aify:storage_full', h)
  }, [])

  // ── Content CRUD ────────────────────────────────────────────────────────────

  const eliminarContenidoCliente = useCallback((clienteId) => {
    setContenido(prev => {
      const updated = { ...prev }
      delete updated[String(clienteId)]
      return updated
    })
  }, [])

  // ── Post states ─────────────────────────────────────────────────────────────

  const cambiarEstadoPost = useCallback((postId, estado) => {
    setEstados(prev => ({ ...prev, [String(postId)]: estado }))
  }, [])

  const obtenerEstadoPost = useCallback((postId) => {
    return estados[String(postId)] || 'borrador'
  }, [estados])

  // ── Active client ───────────────────────────────────────────────────────────

  // Fuente única del cliente activo para todas las páginas de creación.
  // Siempre un id en string (o null).
  const setClienteActivo = useCallback((id) => {
    const next = parseClienteActivo(id)
    setClienteActivoState(prev => (prev === next ? prev : next))
    try {
      if (next === null) localStorage.removeItem(LS_ACTIVO)
      else localStorage.setItem(LS_ACTIVO, next)
    } catch { /* almacenamiento no disponible */ }
  }, [])

  // Sincroniza entre pestañas
  useEffect(() => {
    const h = (e) => {
      if (e.key !== LS_ACTIVO && e.key !== null) return
      setClienteActivoState(readClienteActivo())
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // ── Cache clear ─────────────────────────────────────────────────────────────

  const limpiarCache = useCallback(() => {
    // The bulk of storage usage is per-month calendars and cached API
    // responses, not aify_contenido alone — clear all of it so this actually
    // frees space instead of leaving the real culprits behind.
    const clearablePrefixes = ['aify_calendario_', 'aify_guion_', 'aify_festivos_', 'aify_tendencias_', 'aify_related_', 'aify_yt_']
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && clearablePrefixes.some(p => key.startsWith(p))) keysToRemove.push(key)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
    localStorage.removeItem(LS_CONTENIDO)
    setContenido({})
  }, [])

  return (
    <AppContext.Provider value={{
      contenido,
      estados,
      clienteActivo,
      eliminarContenidoCliente,
      cambiarEstadoPost,
      obtenerEstadoPost,
      setClienteActivo,
      limpiarCache,
    }}>
      {children}
      <StorageFullToast visible={storageFull} onClose={() => setStorageFull(false)} />
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

// ── Storage full toast ────────────────────────────────────────────────────────

function StorageFullToast({ visible, onClose }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 600,
            background: 'white', borderRadius: 14, padding: '14px 18px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid rgba(255,59,48,0.2)',
            display: 'flex', alignItems: 'center', gap: 12, maxWidth: 340,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,59,48,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HardDrive size={18} color="#FF3B30" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 2 }}>
              Almacenamiento lleno
            </div>
            <div style={{ fontSize: 11, color: '#86868B', lineHeight: 1.4 }}>
              Ve a Configuración y limpia el caché de contenido.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868B', display: 'flex', padding: 2 }}
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
