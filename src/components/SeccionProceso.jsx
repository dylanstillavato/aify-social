import { useState } from 'react'
import { motion } from 'framer-motion'
import { ListOrdered, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Plus, RotateCcw } from 'lucide-react'
import { useProceso } from '../hooks/useProceso'
import { PASOS_CLIENTE, MAX_PASOS, nuevoPasoId, procesoEditable } from '../utils/pasosCliente'

// Configuración → Proceso del mes (Fase 7): renombrar, ocultar, reordenar y
// añadir pasos del "Proceso de <mes>" de la ficha de cliente. Los pasos de
// siempre se pueden ocultar pero no borrar (sus pantallas siguen existiendo);
// los personalizados sí se borran.

const nombreOriginal = (id) => PASOS_CLIENTE.find(p => p.id === id)?.label

export default function SeccionProceso({ esOwner, onGuardado }) {
  const proceso = useProceso()
  const [borrador, setBorrador] = useState(null)
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const lista = borrador || proceso.editable
  const sucio = borrador !== null && JSON.stringify(borrador) !== JSON.stringify(proceso.editable)
  const bloqueado = proceso.loading || (proceso.enOrganizacion && !esOwner)
  const visibles = lista.filter(p => !p.oculto).length

  const editar = (fn) => setBorrador(fn(lista.map(p => ({ ...p }))))
  const cambiar = (id, cambios) => editar(l => l.map(p => p.id === id ? { ...p, ...cambios } : p))
  const mover = (i, d) => editar(l => { const j = i + d; if (j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j], l[i]]; return l })
  const añadir = () => {
    const label = nuevo.trim().slice(0, 40)
    if (!label || lista.length >= MAX_PASOS) return
    editar(l => [...l, { id: nuevoPasoId(), label, oculto: false, personalizado: true }])
    setNuevo('')
  }

  const guardar = async () => {
    setGuardando(true); setAviso(null)
    // Nombre vacío = el de siempre
    const limpia = lista.map(p => ({ ...p, label: p.label.trim() || nombreOriginal(p.id) || p.label }))
    const { soloLocal } = await proceso.guardar(limpia)
    setGuardando(false)
    setBorrador(null)
    setAviso(soloLocal ? 'Guardado solo en este navegador: falta la migración 0029 o no eres el propietario.' : null)
    onGuardado?.()
  }

  const restaurar = () => setBorrador(procesoEditable(null))

  const input = {
    flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)',
    fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none',
  }
  const icono = (activo = true) => ({
    width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activo && !bloqueado ? 'pointer' : 'default', opacity: activo ? 1 : 0.3,
  })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} style={{ maxWidth: 680, marginTop: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)', padding: '16px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ListOrdered size={17} color="#1D5FE0" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Proceso del mes</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Los pasos que ves en la ficha de cada cliente</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14, opacity: bloqueado && !proceso.loading ? 0.6 : 1 }}>
          {lista.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
              <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>{i + 1}</span>
              <input value={p.label} disabled={bloqueado} maxLength={40}
                onChange={e => cambiar(p.id, { label: e.target.value })}
                placeholder={nombreOriginal(p.id) || 'Nombre del paso'}
                style={{ ...input, textDecoration: p.oculto ? 'line-through' : 'none', color: p.oculto ? 'var(--text-tertiary)' : 'var(--text-primary)' }} />
              {p.personalizado
                ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, width: 62 }}>Casilla</span>
                : <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, width: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nombreOriginal(p.id)}>
                    {p.label.trim() && p.label.trim() !== nombreOriginal(p.id) ? nombreOriginal(p.id) : ''}
                  </span>}
              <button onClick={() => !bloqueado && mover(i, -1)} disabled={bloqueado || i === 0} aria-label="Subir" style={icono(i > 0)}><ChevronUp size={15} color="var(--text-secondary)" /></button>
              <button onClick={() => !bloqueado && mover(i, 1)} disabled={bloqueado || i === lista.length - 1} aria-label="Bajar" style={icono(i < lista.length - 1)}><ChevronDown size={15} color="var(--text-secondary)" /></button>
              {p.personalizado ? (
                <button onClick={() => !bloqueado && editar(l => l.filter(x => x.id !== p.id))} disabled={bloqueado} aria-label="Borrar paso" title="Borrar paso" style={icono()}>
                  <Trash2 size={14} color="#FF3B30" />
                </button>
              ) : (
                <button onClick={() => !bloqueado && (p.oculto || visibles > 1) && cambiar(p.id, { oculto: !p.oculto })} disabled={bloqueado || (!p.oculto && visibles <= 1)}
                  aria-label={p.oculto ? 'Mostrar paso' : 'Ocultar paso'} title={p.oculto ? 'Mostrar paso' : 'Ocultar paso'} style={icono(p.oculto || visibles > 1)}>
                  {p.oculto ? <EyeOff size={14} color="var(--text-tertiary)" /> : <Eye size={14} color="var(--text-secondary)" />}
                </button>
              )}
            </div>
          ))}
        </div>

        {!bloqueado && lista.length < MAX_PASOS && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={nuevo} onChange={e => setNuevo(e.target.value)} maxLength={40}
              onKeyDown={e => { if (e.key === 'Enter') añadir() }}
              placeholder="Añadir un paso, p. ej. Reunión mensual" style={input} />
            <button onClick={añadir} disabled={!nuevo.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: nuevo.trim() ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: nuevo.trim() ? 'pointer' : 'default' }}>
              <Plus size={13} /> Añadir
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <p style={{ flex: 1, fontSize: 12, margin: 0, color: aviso ? '#FF9500' : 'var(--text-tertiary)', lineHeight: 1.45, minWidth: 200 }}>
            {aviso || (proceso.enOrganizacion && !esOwner && !proceso.loading
              ? 'Solo el propietario de la organización puede cambiar el proceso.'
              : 'Los pasos añadidos son una casilla de "hecho" y una nota por mes en cada cliente.')}
          </p>
          {!bloqueado && (
            <button onClick={restaurar} title="Volver a los seis pasos de siempre"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              <RotateCcw size={12} /> Restaurar
            </button>
          )}
          {sucio && (
            <button onClick={guardar} disabled={guardando}
              style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: guardando ? 'wait' : 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar proceso'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
