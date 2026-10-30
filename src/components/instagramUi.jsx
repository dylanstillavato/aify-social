// Piezas visuales compartidas por DmAutomaticos (mismo aspecto que las
// tarjetas de SeguimientoCliente).
import { labelStyle, cardStyle, textoSecundario } from './instagramEstilos'

export function Tarjeta({ titulo, accion, children }) {
  return (
    <div style={cardStyle}>
      {(titulo || accion) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {titulo && <p style={labelStyle}>{titulo}</p>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

const TONOS = {
  neutro: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
  ok: { bg: 'rgba(48,164,108,0.10)', color: '#1F7A4D' },
  error: { bg: 'rgba(255,59,48,0.08)', color: '#C4271D' },
  aviso: { bg: 'rgba(255,159,10,0.10)', color: '#A05A00' },
}

export function Aviso({ tono = 'neutro', children, style }) {
  const colores = TONOS[tono] || TONOS.neutro
  return (
    <p style={{ ...textoSecundario, background: colores.bg, color: colores.color, padding: '10px 12px', borderRadius: 10, marginBottom: 14, ...style }}>
      {children}
    </p>
  )
}

export function Chip({ tono = 'neutro', children }) {
  const colores = TONOS[tono] || TONOS.neutro
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: colores.bg, color: colores.color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}
