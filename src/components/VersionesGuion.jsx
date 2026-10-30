import { useState } from 'react'
import { History, ChevronDown, Undo2, Eye, EyeOff } from 'lucide-react'
import TablaPlanos from './TablaPlanos'
import { esCarrusel } from '../utils/formato'

// Versiones anteriores de un guion guardado en un post (calendario_posts.
// guion_historial). Las llena solo el trigger guardar_historial_guion_copy
// (0008) cada vez que el guion cambia: al regenerar, al cambiar de formato, al
// guardar planos o al borrarlo con "Regenerar contenido". Restaurar vuelve a
// guardar esa versión como actual, así que la que se reemplaza también entra
// en el historial: se puede ir y volver sin perder nada.

const fechaHora = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const VISIBLES = 8

function Vista({ guion }) {
  if (!guion) return <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Versión vacía.</p>
  const carrusel = esCarrusel({ guion })
  const frases = guion.contenido?.frases || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {guion.gancho && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1D5FE0', marginBottom: 2 }}>{carrusel ? 'PORTADA' : 'GANCHO'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{guion.gancho}</div>
        </div>
      )}
      {guion.planos?.length ? (
        <TablaPlanos planos={guion.planos} carrusel={carrusel} />
      ) : frases.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {frases.map((f, i) => <li key={i}>{f}</li>)}
        </ol>
      )}
      {guion.cierre?.cta && (
        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}><strong>CTA:</strong> {guion.cierre.cta}</div>
      )}
    </div>
  )
}

export default function VersionesGuion({ historial = [], onRestaurar, restaurando = false }) {
  const [abierto, setAbierto] = useState(false)
  const [viendo, setViendo] = useState(null)
  const [todas, setTodas] = useState(false)
  if (!historial.length) return null
  const ordenado = [...historial].reverse() // la más reciente primero
  const lista = todas ? ordenado : ordenado.slice(0, VISIBLES)

  return (
    <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={13} /> Versiones anteriores ({historial.length})
        </span>
        <ChevronDown size={14} color="#86868B" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {abierto && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.map((entrada, idx) => {
            const abiertaEsta = viendo === idx
            return (
              <div key={`${entrada.guardado_en}-${idx}`} style={{ borderRadius: 10, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {idx === 0 ? 'Versión anterior' : `Hace ${idx + 1} versiones`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fechaHora(entrada.guardado_en)}{entrada.guion?.gancho ? ` · ${entrada.guion.gancho}` : ''}
                    </div>
                  </div>
                  <button onClick={() => setViendo(abiertaEsta ? null : idx)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit', flexShrink: 0 }}>
                    {abiertaEsta ? <EyeOff size={11} /> : <Eye size={11} />} {abiertaEsta ? 'Ocultar' : 'Ver'}
                  </button>
                  <button onClick={() => onRestaurar(entrada.guion)} disabled={restaurando || !entrada.guion}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: restaurando ? 'wait' : 'pointer', fontSize: 11, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', flexShrink: 0, opacity: restaurando ? 0.6 : 1 }}>
                    <Undo2 size={11} /> {restaurando ? 'Restaurando...' : 'Restaurar'}
                  </button>
                </div>
                {abiertaEsta && (
                  <div style={{ padding: '4px 10px 10px' }}>
                    <Vista guion={entrada.guion} />
                  </div>
                )}
              </div>
            )
          })}
          {!todas && ordenado.length > VISIBLES && (
            <button onClick={() => setTodas(true)}
              style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit' }}>
              Ver las {ordenado.length} versiones
            </button>
          )}
        </div>
      )}
    </div>
  )
}
