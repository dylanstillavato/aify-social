import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Edit3 } from 'lucide-react'
import TablaPlanos from './TablaPlanos'
import { crearPost } from '../hooks/useCalendario'

// Guiones del mes → "Escribir guion": un guion escrito a mano, sin IA. Entra
// igual que los generados: un post sin programar del mes (en_calendario =
// false, ver 0030), con gancho y planos, listo para aprobar y grabar.
// Vídeo o carrusel: en el carrusel el gancho es la portada y los planos son
// slides con texto e imagen.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const PLANO_VACIO = { segundos: '', plano: '', visual: '', dice: '' }

const campo = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border-color)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
}
const etiqueta = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

export default function EscribirGuionModal({ open, onClose, cliente, año, mes, onGuardado }) {
  const [titulo, setTitulo] = useState('')
  const [gancho, setGancho] = useState('')
  const [planos, setPlanos] = useState([{ ...PLANO_VACIO }])
  const [formato, setFormato] = useState('video')
  const carrusel = formato === 'carrusel'
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const limpiar = () => { setTitulo(''); setGancho(''); setPlanos([{ ...PLANO_VACIO }]); setFormato('video'); setError(null) }
  const cerrar = () => { if (guardando) return; limpiar(); onClose() }
  const listo = titulo.trim() && gancho.trim()

  const guardar = async () => {
    if (!listo || guardando || !cliente) return
    setGuardando(true); setError(null)
    const red = Object.entries(cliente.redesDetalladas || {}).find(([, r]) => r?.activa)?.[0] || 'instagram'
    // Los planos totalmente vacíos no se guardan
    const limpios = planos.filter(p => Object.values(p).some(v => String(v || '').trim()))
    const { error: err } = await crearPost({
      clienteId: cliente.id, fecha: `${año}-${String(mes + 1).padStart(2, '0')}-01`, dia: 1, mes: mes + 1, año,
      red, formato, titulo: titulo.trim(), concepto: gancho.trim(),
      guion: { gancho: gancho.trim(), planos: limpios, manual: true, ...(carrusel ? { formato: 'carrusel' } : {}) }, desarrollado: true,
      estado: 'borrador', enCalendario: false,
    })
    setGuardando(false)
    if (err) { setError(err.message || 'No se pudo guardar el guion.'); return }
    limpiar()
    onGuardado?.()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{ pointerEvents: 'auto', width: 640, maxWidth: '100%', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Edit3 size={16} color="#1D5FE0" /> Escribir guion
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{cliente?.nombre} · {MESES[mes]} {año}</p>
                </div>
                <button onClick={cerrar} aria-label="Cerrar"
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} color="var(--text-secondary)" />
                </button>
              </div>

              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['video', 'Vídeo'], ['carrusel', 'Carrusel']].map(([id, label]) => (
                    <button key={id} onClick={() => setFormato(id)}
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${formato === id ? '#1D5FE0' : 'var(--border-color)'}`, background: formato === id ? '#1D5FE0' : 'var(--bg-card)', color: formato === id ? 'white' : 'var(--text-primary)' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={etiqueta}>{carrusel ? 'Título del carrusel' : 'Título del vídeo'}</label>
                  <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={carrusel ? 'Ej: 5 errores al pedir pizza a domicilio' : 'Ej: Cómo preparamos la pizza del mes'} style={campo} />
                </div>
                <div>
                  <label style={etiqueta}>{carrusel ? 'Portada (el texto de la primera slide)' : 'Gancho (lo primero que se dice o se ve)'}</label>
                  <textarea value={gancho} onChange={e => setGancho(e.target.value)} rows={2}
                    placeholder="Ej: Nadie te cuenta esto de la masa madre..." style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <div>
                  <label style={etiqueta}>{carrusel ? 'Slides' : 'Planos'}</label>
                  <TablaPlanos planos={planos} onChange={setPlanos} carrusel={carrusel} />
                </div>
                {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: 0 }}>{error}</p>}
              </div>

              <div style={{ padding: '14px 22px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={cerrar}
                  style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={guardar} disabled={!listo || guardando}
                  style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: listo ? '#D7FF3D' : 'var(--bg-secondary)', color: listo ? '#0B0C10' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: listo && !guardando ? 'pointer' : 'not-allowed' }}>
                  {guardando ? 'Guardando...' : 'Guardar guion'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
