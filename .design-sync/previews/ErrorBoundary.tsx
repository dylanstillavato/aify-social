import { ErrorBoundary } from 'aify'

function Boom(): never {
  throw new Error('Fallo de ejemplo para demostrar el estado de error')
}

export function Default() {
  return (
    <ErrorBoundary>
      <div style={{
        maxWidth: 420, margin: '40px auto', padding: 24, borderRadius: 16,
        background: '#FFFFFF', boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.05)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: '0 0 6px' }}>Panel de cliente</p>
        <p style={{ fontSize: 13, color: '#6E6E73', margin: 0, lineHeight: 1.5 }}>
          Contenido protegido — se muestra con normalidad cuando no hay errores.
        </p>
      </div>
    </ErrorBoundary>
  )
}

export function CaughtError() {
  return (
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>
  )
}
