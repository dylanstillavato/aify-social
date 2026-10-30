import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Copy, Check, MessageCircle, Link2Off, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { crearEnlaceOnboarding, revocarEnlaceOnboarding, useOnboardingsList, urlFormulario, estadoOnboarding } from '../hooks/useOnboardings'
import { useOrganizacion } from '../hooks/useOrganizacion'

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: '#FF9500' },
  completado: { label: 'Completado', color: '#30D158' },
  revocado: { label: 'Revocado', color: '#86868B' },
  caducado: { label: 'Caducado', color: '#86868B' },
}

function mensajeWhatsApp(url, nombre) {
  return `${nombre ? `Hola, ${nombre}. ` : 'Hola. '}Para empezar a preparar tu contenido necesito conocer bien tu negocio. ¿Me rellenas este formulario? Tardas unos 10 minutos: ${url}`
}

// Modal para mandar al cliente el formulario de onboarding (ver
// useOnboardings.js). Sin `cliente`: el envío crea un cliente nuevo. Con
// `cliente`: el formulario llega prerrellenado y completa esa ficha.
export default function EnviarFormularioModal({ open, onClose, cliente = null }) {
  const navigate = useNavigate()
  const { organizacion } = useOrganizacion()
  const { onboardings } = useOnboardingsList({ clienteId: cliente?.id })
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [enlace, setEnlace] = useState(null)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const lista = cliente ? onboardings : onboardings.filter(o => !o.cliente_id)

  const cerrar = () => { setEnlace(null); setNombre(''); setError(null); onClose?.() }

  const crear = async () => {
    setCreando(true); setError(null)
    const { data, error: err } = await crearEnlaceOnboarding({
      nombreCliente: cliente ? cliente.nombre : nombre,
      clienteId: cliente?.id,
      organizacionId: organizacion?.id,
    })
    setCreando(false)
    if (err) { setError(err.message || 'No se pudo crear el enlace'); return }
    setEnlace(data)
  }

  const copiar = async (url, id) => {
    try { await navigator.clipboard.writeText(url) } catch { /* sin permiso de portapapeles */ }
    setCopiado(id); setTimeout(() => setCopiado(null), 1600)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: 14,
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
      {open && (
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
                      {cliente ? 'Pedir al cliente que complete su ficha' : 'Enviar formulario al cliente'}
                    </p>
                  </div>
                  <button onClick={cerrar} style={iconBtn}><X size={18} /></button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' }}>
                  {cliente
                    ? `${cliente.nombre} recibirá el formulario con lo que ya tienes rellenado. Lo que complete se guarda en su ficha.`
                    : 'Tu cliente rellena el onboarding desde el móvil, sin cuenta. Cuando lo envíe, aparece en Mis Clientes con todo relleno.'}
                </p>

                {enlace ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input readOnly value={enlace.url} onFocus={e => e.target.select()} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
                      <button onClick={() => copiar(enlace.url, 'nuevo')} style={{ ...btn(true), flexShrink: 0 }}>
                        {copiado === 'nuevo' ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                      </button>
                    </div>
                    <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(enlace.url, enlace.nombre_cliente))}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...btn(false), textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
                      <MessageCircle size={15} color="#30D158" /> Enviar por WhatsApp
                    </a>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '10px 0 0' }}>El enlace caduca en 30 días y solo se puede enviar una vez.</p>
                  </div>
                ) : (
                  <div>
                    {!cliente && (
                      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del cliente (opcional)"
                        style={{ ...inputStyle, marginBottom: 10 }} onKeyDown={e => { if (e.key === 'Enter') crear() }} />
                    )}
                    <button onClick={crear} disabled={creando} style={{ ...btn(true), width: '100%', opacity: creando ? 0.6 : 1 }}>
                      <Send size={15} /> {creando ? 'Creando enlace...' : 'Crear enlace'}
                    </button>
                  </div>
                )}
                {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>{error}</p>}
              </div>

              {lista.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Enlaces enviados</p>
                  {lista.map(o => {
                    const est = estadoOnboarding(o), e = ESTADOS[est]
                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.nombre_cliente || 'Sin nombre'}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                            {new Date(o.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: e.color, background: `${e.color}18` }}>{e.label}</span>
                        {est === 'pendiente' && (
                          <>
                            <button title="Copiar enlace" onClick={() => copiar(urlFormulario(o.token), o.id)} style={iconBtn}>
                              {copiado === o.id ? <Check size={15} color="#30D158" /> : <Copy size={15} />}
                            </button>
                            <button title="Revocar enlace" onClick={() => revocarEnlaceOnboarding(o.id)} style={iconBtn}><Link2Off size={15} /></button>
                          </>
                        )}
                        {est === 'completado' && o.cliente_creado_id && !cliente && (
                          <button title="Ver cliente" onClick={() => { cerrar(); navigate(`/clientes/${o.cliente_creado_id}`) }} style={iconBtn}><ExternalLink size={15} /></button>
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
