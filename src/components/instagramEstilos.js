// Estilos compartidos por DmAutomaticos (mismo aspecto
// que las tarjetas de SeguimientoCliente).

export const labelStyle = {
  fontSize: 11, fontWeight: 600, color: '#86868B',
  textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
}

export const cardStyle = {
  background: 'var(--bg-card)', borderRadius: 18, padding: 22,
  boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
  marginBottom: 16,
}

export const botonPrimario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'var(--text-primary)', color: 'var(--bg-card)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
}

export const botonSecundario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
}

export const textoSecundario = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }

export const campoStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
}

export const etiquetaCampo = { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }
