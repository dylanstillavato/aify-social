import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquareQuote, Plus, Star, X } from 'lucide-react'
import { guardarVozCliente } from '../hooks/useClientes'
import { TIPOS_VOZ, nuevaFraseVoz, frasesVozValidas } from '../utils/vozCliente'
import AnalizarResenasPanel from './AnalizarResenasPanel'

// Tarjeta "Voz del cliente" del perfil: frases literales de los clientes del
// negocio, agrupadas por tipo. Se edita aquí mismo, sin pasar por "Editar
// perfil": es algo que se va apuntando poco a poco (una reseña nueva, algo
// que alguien dijo en caja), no un formulario que se rellena una vez.

const estiloInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

export default function VozClienteCard({ cliente, onClienteActualizado }) {
  const [tipo, setTipo] = useState('motivo')
  const [texto, setTexto] = useState('')
  const [fuente, setFuente] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [verResenas, setVerResenas] = useState(false)

  const frases = frasesVozValidas(cliente)
  const tipoActual = TIPOS_VOZ.find(t => t.id === tipo)

  async function guardar(lista) {
    setGuardando(true)
    setError(null)
    const { data, error: err, faltaMigracion } = await guardarVozCliente(cliente.id, lista)
    setGuardando(false)
    if (err) {
      setError(faltaMigracion
        ? 'Falta aplicar la migración 0031_voz_cliente.sql en Supabase. Hasta entonces no se puede guardar.'
        : 'No se ha podido guardar. Inténtalo de nuevo.')
      return false
    }
    onClienteActualizado?.(data || { ...cliente, vozCliente: lista })
    return true
  }

  async function anadir() {
    if (!texto.trim() || guardando) return
    const ok = await guardar([...frases, nuevaFraseVoz({ tipo, texto, fuente })])
    if (ok) setTexto('')
  }

  // Frases elegidas en el panel de reseñas: [{ tipo, texto, fuente }]
  function anadirVarias(nuevas) {
    return guardar([...frases, ...nuevas.map(nuevaFraseVoz)])
  }

  function quitar(id) {
    if (guardando) return
    guardar(frases.filter(f => f.id !== id))
  }

  const grupos = TIPOS_VOZ
    .map(t => ({ ...t, frases: frases.filter(f => f.tipo === t.id) }))
    .filter(g => g.frases.length)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1100 }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 18, padding: 22,
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageSquareQuote size={17} color="#1D5FE0" />
          </div>
          <div style={{ minWidth: 0, flex: '1 1 200px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Voz del cliente {frases.length > 0 && `· ${frases.length}`}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Frases reales de sus clientes, con sus palabras: de reseñas, de lo que cuentan en caja o por DM.
              Aify las usa como ángulos y ganchos al generar ideas y guiones.
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => setVerResenas(v => !v)}
            aria-expanded={verResenas}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, flexShrink: 0,
              border: '1px solid var(--border-color)', background: verResenas ? 'rgba(29,95,224,0.08)' : 'var(--bg-secondary)',
              color: verResenas ? 'var(--accent-blue)' : 'var(--text-primary)', fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            <Star size={13} /> {verResenas ? 'Cerrar reseñas' : 'Sacar de reseñas'}
          </motion.button>
        </div>

        {verResenas && <AnalizarResenasPanel cliente={cliente} guardando={guardando} onAnadir={anadirVarias} />}
        {verResenas && <div style={{ height: 14 }} />}

        {/* Alta rápida */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {TIPOS_VOZ.map(t => (
            <button key={t.id} type="button" onClick={() => setTipo(t.id)}
              style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${tipo === t.id ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                background: tipo === t.id ? 'rgba(29,95,224,0.08)' : 'transparent',
                color: tipo === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadir() } }}
            placeholder={`Ej.: "${tipoActual?.ejemplo}"`}
            aria-label="Frase del cliente"
            style={{ ...estiloInput, flex: '3 1 320px' }}
          />
          <input
            value={fuente}
            onChange={e => setFuente(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadir() } }}
            placeholder="Dónde (opcional): reseña, en caja..."
            aria-label="Dónde lo dijo"
            style={{ ...estiloInput, flex: '1 1 180px' }}
          />
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={anadir} disabled={!texto.trim() || guardando}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', minHeight: 40, borderRadius: 10, border: 'none',
              background: !texto.trim() || guardando ? 'var(--bg-secondary)' : 'var(--accent-blue)',
              color: !texto.trim() || guardando ? 'var(--text-tertiary)' : 'white',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: !texto.trim() || guardando ? 'not-allowed' : 'pointer',
            }}>
            <Plus size={14} /> {guardando ? 'Guardando...' : 'Añadir'}
          </motion.button>
        </div>
        {error && <p style={{ fontSize: 12, color: '#FF3B30', margin: '8px 0 0' }}>{error}</p>}

        {/* Frases guardadas */}
        {grupos.length > 0 ? (
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            {grupos.map(g => (
              <div key={g.id} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  {g.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.frases.map(f => (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px 9px 12px', borderRadius: 10,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                          “{f.texto}”
                        </p>
                        {f.fuente && (
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '3px 0 0', overflowWrap: 'anywhere' }}>{f.fuente}</p>
                        )}
                      </div>
                      <button type="button" onClick={() => quitar(f.id)} disabled={guardando}
                        title="Quitar frase" aria-label="Quitar frase"
                        style={{ background: 'none', border: 'none', padding: 2, cursor: guardando ? 'not-allowed' : 'pointer', color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '14px 0 0', lineHeight: 1.5 }}>
            Todavía no hay frases. Empieza por una pregunta en caja o al reservar: "¿por qué nos has elegido?".
            Las reseñas de Google también sirven, copiadas tal cual.
          </p>
        )}
      </div>
    </motion.div>
  )
}
