import { CAMPOS_HISTORIA, normalizarHistoria } from '../utils/historia'

// La historia en 5 líneas de un guion (guion.historia), solo lectura. Los
// guiones de antes no la tienen: entonces no pinta nada.
// `paraCliente` usa etiquetas sin jerga (vista de aprobación del cliente).
export default function HistoriaCincoLineas({ historia, paraCliente = false, style }) {
  const h = normalizarHistoria(historia)
  if (!h) return null
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)', marginBottom: 12, ...style }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {paraCliente ? 'La historia de este vídeo' : 'La historia en 5 líneas'}
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CAMPOS_HISTORIA.map(({ key, label, paraCliente: etiquetaCliente }, i) => (
          <li key={key} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1D5FE0', flexShrink: 0, width: 14 }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>{paraCliente ? etiquetaCliente : label}:</span> {h[key]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
