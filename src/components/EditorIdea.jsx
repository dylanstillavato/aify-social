import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Undo2, Video, Images, Save, ArrowRight } from 'lucide-react'
import { reescribirIdea } from '../services/ai'
import { formatoDe, esSinTexto, etiquetaEstilo } from '../utils/formato'

// "Desarrollar" una idea: antes de escribir su guion, el gestor la ajusta.
// Se edita a mano (título y de qué va), se le piden cambios a la IA ("que
// pase de noche", "con la dueña en el plano"...) y se elige formato (vídeo o
// carrusel) y estilo (con guion o sin texto: solo planos / solo fotos).
// Cambiar formato o estilo reescribe la idea entera para ese formato, para
// que no quede "carrusel de 5 fotos" en un vídeo.
// onGuardar(campos) guarda la idea (nueva o ya guardada) y devuelve la idea
// guardada; onEscribirGuion(idea) la manda a Guiones del mes como el resto.

const campo = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border-color)',
  fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', lineHeight: 1.5,
}
const label = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }

function Segmentado({ opciones, valor, onChange, disabled }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', borderRadius: 9, padding: 2 }}>
      {opciones.map(o => {
        const activo = valor === o.id
        const Icon = o.icon
        return (
          <button key={String(o.id)} type="button" disabled={disabled} onClick={() => !activo && onChange(o.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', background: activo ? 'var(--bg-card)' : 'transparent', color: activo ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: activo ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {Icon && <Icon size={12} />} {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function EditorIdea({ idea, cliente, onClose, onGuardar, onEscribirGuion }) {
  const [form, setForm] = useState(() => ({
    titulo: idea.titulo || '',
    concepto: idea.concepto || '',
    formatoSugerido: idea.formatoSugerido || '',
    porQueFunc: idea.porQueFunc || '',
    formato: formatoDe(idea),
    sinTexto: esSinTexto(idea),
  }))
  const [indicaciones, setIndicaciones] = useState('')
  const [anterior, setAnterior] = useState(null) // para deshacer la última reescritura
  const [trabajando, setTrabajando] = useState(null) // 'ia' | 'guardar' | 'guion'
  const [error, setError] = useState(null)
  const ocupado = !!trabajando
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Reescribe con la IA: con las indicaciones y/o al cambiar formato o estilo
  const reescribir = async (cambios = {}) => {
    const destino = { ...form, ...cambios }
    setTrabajando('ia'); setError(null)
    try {
      const nueva = await reescribirIdea(cliente, form, { indicaciones, formato: destino.formato, sinTexto: destino.sinTexto })
      setAnterior(form)
      setForm({ ...destino, ...nueva })
      setIndicaciones('')
    } catch (e) {
      setError(e.message || 'La IA no ha podido reescribir la idea.')
    } finally {
      setTrabajando(null)
    }
  }

  const guardar = async (yEscribir) => {
    if (!form.titulo.trim()) return
    setTrabajando(yEscribir ? 'guion' : 'guardar'); setError(null)
    try {
      const guardada = await onGuardar({
        titulo: form.titulo.trim(), concepto: form.concepto.trim(), formato: form.formato,
        formatoSugerido: form.formatoSugerido, porQueFunc: form.porQueFunc,
      })
      if (!guardada) throw new Error('No se pudo guardar la idea.')
      onClose()
      if (yEscribir) onEscribirGuion({ ...guardada, sinTexto: form.sinTexto })
    } catch (e) {
      setError(e.message || 'No se pudo guardar la idea.')
      setTrabajando(null)
    }
  }

  return (
    <AnimatePresence>
      <motion.div key="fondo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !ocupado && onClose()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
      <div key="modal" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
          onClick={e => e.stopPropagation()}
          style={{ pointerEvents: 'auto', width: 600, maxWidth: '100%', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Desarrollar idea</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Ajústala a tu gusto y luego escribe su guion</p>
            </div>
            <button onClick={onClose} disabled={ocupado} aria-label="Cerrar"
              style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: ocupado ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} color="var(--text-secondary)" />
            </button>
          </div>

          <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, opacity: trabajando === 'ia' ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Segmentado disabled={ocupado} valor={form.formato}
                opciones={[{ id: 'video', label: 'Vídeo', icon: Video }, { id: 'carrusel', label: 'Carrusel', icon: Images }]}
                onChange={v => reescribir({ formato: v })} />
              <Segmentado disabled={ocupado} valor={form.sinTexto}
                opciones={[{ id: false, label: etiquetaEstilo(form.formato, false) }, { id: true, label: etiquetaEstilo(form.formato, true) }]}
                onChange={v => reescribir({ sinTexto: v })} />
            </div>

            <div>
              <span style={label}>Título</span>
              <input value={form.titulo} onChange={e => up('titulo', e.target.value)} disabled={ocupado} style={{ ...campo, fontWeight: 600 }} />
            </div>
            <div>
              <span style={label}>De qué va</span>
              <textarea value={form.concepto} onChange={e => up('concepto', e.target.value)} disabled={ocupado} rows={4} style={{ ...campo, resize: 'vertical' }} />
            </div>
            <div>
              <span style={label}>Formato</span>
              <input value={form.formatoSugerido} onChange={e => up('formatoSugerido', e.target.value)} disabled={ocupado}
                placeholder={form.formato === 'carrusel' ? 'Carrusel 6 slides' : 'Reel 30s'} style={campo} />
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(29,95,224,0.05)', border: '1px solid rgba(29,95,224,0.12)' }}>
              <span style={{ ...label, color: '#1D5FE0' }}>Cambios para la IA</span>
              <textarea value={indicaciones} onChange={e => setIndicaciones(e.target.value)} disabled={ocupado} rows={2}
                placeholder="Ej.: que pase de noche, con luz cálida y la dueña cerrando el local"
                style={{ ...campo, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => reescribir()} disabled={ocupado || !indicaciones.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: indicaciones.trim() && !ocupado ? '#1D5FE0' : 'var(--bg-secondary)', color: indicaciones.trim() && !ocupado ? 'white' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: indicaciones.trim() && !ocupado ? 'pointer' : 'default' }}>
                  <Sparkles size={12} /> {trabajando === 'ia' ? 'Reescribiendo...' : 'Reescribir la idea'}
                </button>
                {anterior && !ocupado && (
                  <button onClick={() => { setForm(anterior); setAnterior(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <Undo2 size={12} /> Deshacer
                  </button>
                )}
              </div>
            </div>
            {error && <p style={{ fontSize: 12.5, color: '#FF3B30', margin: 0 }}>{error}</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 22px 18px', borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={() => guardar(false)} disabled={ocupado || !form.titulo.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: ocupado ? 'default' : 'pointer' }}>
              <Save size={14} /> {trabajando === 'guardar' ? 'Guardando...' : 'Guardar idea'}
            </button>
            <button onClick={() => guardar(true)} disabled={ocupado || !form.titulo.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: ocupado ? 'default' : 'pointer' }}>
              {trabajando === 'guion' ? 'Guardando...' : <>Guardar y escribir guion <ArrowRight size={14} /></>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
