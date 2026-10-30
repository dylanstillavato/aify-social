import { ProtectedRoute } from 'aify'
import { Zap } from 'lucide-react'

// No live Supabase session exists in this preview environment, so the
// guard always resolves to logged-out. This mirrors aify's own real usage
// (App.jsx passes a custom `fallback` for the same reason) rather than the
// default <Navigate>, which renders nothing visible.
export function Default() {
  return (
    <ProtectedRoute
      fallback={
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, background: '#F5F5F7', gap: 16, padding: 24, textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #0071E3, #5856D6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 30px rgba(0,113,227,0.3)',
          }}>
            <Zap size={24} color="white" />
          </div>
          <p style={{ fontSize: 14, color: '#6E6E73', margin: 0 }}>Inicia sesión para continuar</p>
        </div>
      }
    >
      <div style={{ padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#1D1D1F', margin: 0 }}>
          Contenido protegido, solo visible para usuarios autenticados.
        </p>
      </div>
    </ProtectedRoute>
  )
}
