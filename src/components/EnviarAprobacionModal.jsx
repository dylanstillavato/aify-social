import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Copy, Check, MessageCircle, Link2Off } from 'lucide-react'
import { crearEnlaceAprobacion, revocarEnlaceAprobacion, useAprobacionesList, urlAprobacion, estadoAprobacion } from '../hooks/useAprobaciones'
import { useOrganizacion } from '../hooks/useOrganizacion'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const ESTADOS = {
  activo: { label: 'Activo', color: '#30D158' },
  revocado: { label: 'Revocado', color: '#86868B' },
  caducado: { label: 'Caducado', color: '#86868B' },
}

function mensajeWhatsApp(url, nombre, mes, total) {
  return `${nombre ? `Hola, ${nombre}. ` : 'Hola. '}Ya tienes los ${total} guiones de ${mes}. Revísalos aquí y dime cuáles grabamos tal cual y qué cambiarías: ${url}`
}

// Modal para mandar al cliente los guiones de un mes para que los apruebe
// (ver useAprobaciones.js). Un enlace sirve para todo el mes: si luego se
// añaden o regeneran guiones, el cliente los ve en el mismo enlace.
export default function EnviarAprobacionModal({ open, onClose, cliente, año, mes, totalGuiones }) {
  const { organizacion } = useOrganizacion()
  const { aprobaciones, refetch } = useAprobacionesList({ clienteId: cliente?.id, año, mes })
  const [creando, setCreando] = useState(false)
  const [enlace, setEnlace] = useState(null)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const activo = enlace || aprobaciones.find(a => estadoAprobacion(a) === 'activo')
  const url = activo ? urlAprobacion(activo.token) : null
  const nombreMes = MESES[mes]

  const cerrar = () => { setEnlace(null); setError(null); onClose?.() }

  const crear = async () => {
    setCreando(true); setError(null)
    const { data, error: err } = await crearEnlaceAprobacion({
      clienteId: cliente.id, organizacionId: organizacion?.id, año, mes,
    })
    setCreando(false)
    if (err) { setError(err.message || 'No se pudo crear el enlace'); return }
    setEnlace(data)
    refetch()
  }

  const copiar = async (texto, id) => {
    try { await navigator.clipboard.writeText(texto) } catch { /* sin permiso de portapapeles */ }
    setCopiado(id); setTimeout(() => setCopiado(null), 1600)
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
                      <Send size={16} color="#1D5FE0" />
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Enviar guiones para aprobar
                    </p>
                  </div>
                  <button onClick={cerrar} style={iconBtn}><X size={18} /></button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' }}>
                  {cliente.nombre} ve los {totalGuiones} guiones de {nombreMes} con sus planos, sin cuenta, y aprueba cada uno o te dice qué cambiaría. Si añades o regeneras guiones, los ve en el mismo enlace.
                </p>

                {url ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input readOnly value={url} onFocus={e => e.target.select()} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => copiar(url, 'nuevo')} style={{ ...btn(true), flexShrink: 0 }}>
                        {copiado === 'nuevo' ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                      </button>
                    </div>
                    <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(url, cliente.nombre, nombreMes, totalGuiones))}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...btn(false), textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
                      <MessageCircle size={15} color="#30D158" /> Enviar por WhatsApp
                    </a>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '10px 0 0' }}>El enlace caduca en 30 días.</p>
                  </div>
                ) : (
                  <button onClick={crear} disabled={creando || totalGuiones === 0} style={{ ...btn(true), width: '100%', opacity: (creando || totalGuiones === 0) ? 0.6 : 1 }}>
                    <Send size={15} /> {creando ? 'Creando enlace...' : 'Crear enlace'}
                  </button>
                )}
                {totalGuiones === 0 && !url && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 0' }}>Genera al menos un guion este mes para poder enviarlo.</p>
                )}
                {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>{error}</p>}
              </div>

              {aprobaciones.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Enlaces de {nombreMes}</p>
                  {aprobaciones.map(a => {
                    const est = estadoAprobacion(a), e = ESTADOS[est]
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                            Creado el {new Date(a.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                            {a.ultima_respuesta_en
                              ? `Última respuesta: ${new Date(a.ultima_respuesta_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                              : 'Sin respuestas todavía'}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: e.color, background: `${e.color}18` }}>{e.label}</span>
                        {est === 'activo' && (
                          <>
                            <button title="Copiar enlace" onClick={() => copiar(urlAprobacion(a.token), a.id)} style={iconBtn}>
                              {copiado === a.id ? <Check size={15} color="#30D158" /> : <Copy size={15} />}
                            </button>
                            <button title="Revocar enlace" onClick={() => { revocarEnlaceAprobacion(a.id); if (enlace?.id === a.id) setEnlace(null) }} style={iconBtn}><Link2Off size={15} /></button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
