import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

// Planos de un guión: [{ segundos, plano, visual, dice }]. Los guiones
// antiguos pueden traer texto_pantalla: ya no se enseña ni se edita.
// Una tarjeta por plano en vez de una tabla de 5 columnas, para que se lea
// igual de bien en el móvil del cliente (vista de aprobación) que en la app.
// Con `onChange` cada campo se vuelve editable.
// Con `carrusel` cada plano es una slide: "Texto" (lo que pone, en `dice`) e
// "Imagen" (la foto o el fondo, en `visual`), sin segundos.
// Con `sinTexto` (vídeo de solo planos / carrusel de solo fotos) no hay
// "Se dice" ni "Texto": solo lo que se ve.

const CAMPOS = [
  { key: 'visual', label: 'Se ve' },
  { key: 'dice', label: 'Se dice' },
]
const CAMPOS_CARRUSEL = [
  { key: 'dice', label: 'Texto' },
  { key: 'visual', label: 'Imagen' },
]

const PLANO_VACIO = { segundos: '', plano: '', visual: '', dice: '' }

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none', fontFamily: 'inherit',
  resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
}

const botonIcono = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
  color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0,
}

export default function TablaPlanos({ planos = [], onChange, carrusel = false, sinTexto = false }) {
  const editable = typeof onChange === 'function'
  const campos = (carrusel ? CAMPOS_CARRUSEL : CAMPOS).filter(c => !sinTexto || c.key !== 'dice')
  const nombre = (p, i) => p.plano || (carrusel ? `Slide ${i + 1}` : `Plano ${i + 1}`)
  const set = (i, key, value) => onChange(planos.map((p, j) => j === i ? { ...p, [key]: value } : p))
  const quitar = (i) => onChange(planos.filter((_, j) => j !== i))
  const añadir = () => onChange([...planos, { ...PLANO_VACIO, plano: carrusel ? `Slide ${planos.length + 1}` : '' }])
  // Intercambia el plano i con el de al lado (delta -1 sube, +1 baja).
  const mover = (i, delta) => {
    const j = i + delta
    if (j < 0 || j >= planos.length) return
    const nuevos = [...planos]
    ;[nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]]
    onChange(nuevos)
  }
  const insertarDebajo = (i) => onChange([
    ...planos.slice(0, i + 1),
    { ...PLANO_VACIO, plano: carrusel ? `Slide ${i + 2}` : '' },
    ...planos.slice(i + 1),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {planos.map((p, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, background: 'rgba(29,95,224,0.1)', color: '#1D5FE0',
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{i + 1}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {editable ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={p.plano || ''} onChange={e => set(i, 'plano', e.target.value)} placeholder={carrusel ? 'Slide' : 'Tipo de plano'}
                  style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
                {!carrusel && (
                  <input value={p.segundos || ''} onChange={e => set(i, 'segundos', e.target.value)} placeholder="Seg."
                    style={{ ...inputStyle, width: 72, flexShrink: 0 }} />
                )}
                <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"
                  style={{ ...botonIcono, opacity: i === 0 ? 0.35 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => mover(i, 1)} disabled={i === planos.length - 1} title="Bajar"
                  style={{ ...botonIcono, opacity: i === planos.length - 1 ? 0.35 : 1, cursor: i === planos.length - 1 ? 'default' : 'pointer' }}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => insertarDebajo(i)} title={carrusel ? 'Insertar slide debajo' : 'Insertar plano debajo'} style={botonIcono}>
                  <Plus size={14} />
                </button>
                <button onClick={() => quitar(i)} title="Quitar plano" style={botonIcono}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{nombre(p, i)}</span>
                {!carrusel && p.segundos && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.segundos}s</span>}
              </div>
            )}

            {campos.map(({ key, label }) => (editable || p[key]) ? (
              <div key={key} style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: editable ? 'center' : 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', width: 72, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </span>
                {editable ? (
                  <textarea rows={1} value={p[key] || ''} onChange={e => set(i, key, e.target.value)} style={inputStyle} />
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: key === 'dice' ? 500 : 400 }}>
                    {key === 'dice' && !carrusel ? `“${p[key]}”` : p[key]}
                  </span>
                )}
              </div>
            ) : null)}
          </div>
        </div>
      ))}

      {editable && (
        <button onClick={añadir} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px',
          borderRadius: 10, border: '1.5px dashed var(--border-color)', background: 'none',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={14} /> {carrusel ? 'Añadir slide' : 'Añadir plano'}
        </button>
      )}
    </div>
  )
}
