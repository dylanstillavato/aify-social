import { useNavigate } from 'react-router-dom'
import { ChevronDown, UserPlus } from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'

// Cabecera compartida por las herramientas de Instagram (Métricas, Programar
// publicaciones, DMs automáticos): título, descripción y selector del
// cliente activo (el mismo que usan Guiones del mes o Lluvia de ideas).
// Devuelve el cliente elegido a través de children(cliente).

export default function CabeceraHerramientaInstagram({ titulo, descripcion, ancho = 860, children }) {
  const navigate = useNavigate()
  const { clientes, loading } = useClientesList()
  const { clienteActivoId, setClienteActivoId } = useClienteActivo()
  const cliente = clientes.find(c => String(c.id) === clienteActivoId) || clientes[0] || null

  return (
    <div style={{ padding: '36px 40px', flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: ancho }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 4 }}>{titulo}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{descripcion}</p>
        </div>

        {!loading && clientes.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: 18, padding: 28, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Todavía no tienes clientes</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>Crea un cliente y conecta su Instagram para usar esta herramienta.</p>
            <button type="button" onClick={() => navigate('/nuevo-cliente')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-card)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              <UserPlus size={14} /> Crear cliente
            </button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', maxWidth: 340, marginBottom: 16 }}>
              <select
                value={cliente?.id || ''}
                onChange={e => setClienteActivoId(e.target.value)}
                style={{
                  width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11, border: '1px solid var(--border-color)',
                  fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-card)', cursor: 'pointer',
                  fontFamily: 'inherit', outline: 'none', appearance: 'none',
                }}
              >
                {loading && <option>Cargando clientes...</option>}
                {clientes.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
              </select>
              <ChevronDown size={14} color="#86868B" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            {cliente && children(cliente)}
          </>
        )}
      </div>
    </div>
  )
}
