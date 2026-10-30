import { Component } from 'react'
import { RefreshCw, Zap } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F5F5F7', gap: 20, padding: 24, textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #007BFF, #4DA3FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(29,95,224,0.3)',
        }}>
          <Zap size={24} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>
            Algo ha ido mal
          </p>
          <p style={{ fontSize: 14, color: '#6E6E73', maxWidth: 380 }}>
            Ha ocurrido un error inesperado. Recarga la página para continuar — si el problema persiste, avísanos.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12, border: 'none',
            background: '#1D5FE0', color: 'white', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={15} /> Recargar página
        </button>
      </div>
    )
  }
}
