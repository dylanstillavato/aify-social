import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, Check, X } from 'lucide-react'
import { reiniciarCliente, SE_BORRA, SE_CONSERVA } from '../utils/reiniciarCliente'

// Perfil del cliente → "Empezar de cero": borra ideas, calendario, guiones,
// tareas, investigación y fechas del cliente y conserva su ficha (ver
// utils/reiniciarCliente.js). No se puede deshacer: se confirma escribiendo
// el nombre del cliente.

export default function EmpezarDeCero({ cliente, onHecho }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState(null)
  const nombre = (cliente?.nombre || '').trim()
  const coincide = texto.trim().toLowerCase() === nombre.toLowerCase() && nombre.length > 0

  const cerrar = () => { if (trabajando) return; setAbierto(false); setTexto(''); setError(null) }

  const confirmar = async () => {
    if (!coincide || trabajando) return
    setTrabajando(true); setError(null)
    const { error: err } = await reiniciarCliente(cliente.id)
    setTrabajando(false)
    if (err) { setError(err.message || 'No se pudo completar. Inténtalo de nuevo.'); return }
    setAbierto(false); setTexto('')
    onHecho?.()
  }

  const lista = (items, icono, color) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(i => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
          {icono === 'x' ? <X size={13} color={color} /> : <Check size={13} color={color} />} {i}
        </li>
      ))}
    </ul>
  )

  return (
    <div style={{ maxWidth: 820, marginTop: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(255,59,48,0.25)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Empezar de cero</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
            Borra ideas, calendario, guiones, tareas e investigación de {nombre || 'este cliente'}. Su ficha se queda como está.
          </div>
        </div>
        <button onClick={() => setAbierto(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: '1px solid rgba(255,59,48,0.35)', background: 'rgba(255,59,48,0.06)', color: '#FF3B30', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          <RotateCcw size={14} /> Empezar de cero
        </button>
      </div>

      <AnimatePresence>
        {abierto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 16 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 26, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <RotateCcw size={20} color="#FF3B30" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>¿Empezar de cero con {nombre}?</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>No se puede deshacer.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8 }}>Se borra</div>
                  {lista(SE_BORRA, 'x', '#FF3B30')}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#30D158', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8 }}>Se queda</div>
                  {lista(SE_CONSERVA, 'check', '#30D158')}
                </div>
              </div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Escribe <strong>{nombre}</strong> para confirmar
              </label>
              <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} disabled={trabajando}
                onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') cerrar() }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border-color)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', marginBottom: 16 }} />
              {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '-6px 0 14px' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={cerrar} disabled={trabajando}
                  style={{ flex: 1, padding: 11, borderRadius: 12, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={confirmar} disabled={!coincide || trabajando}
                  style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: coincide && !trabajando ? 'pointer' : 'not-allowed', background: coincide ? '#FF3B30' : 'rgba(255,59,48,0.35)', color: 'white' }}>
                  {trabajando ? 'Borrando...' : 'Empezar de cero'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
