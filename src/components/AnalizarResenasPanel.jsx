import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Sparkles, Star } from 'lucide-react'
import { obtenerResenasGoogle, extraerVozDeResenas } from '../services/ai'
import { etiquetaTipoVoz } from '../utils/vozCliente'
import { mensajeErrorAmigable } from '../utils/errorMessage'

// Panel de "Voz del cliente" para sacar frases de las reseñas del negocio:
//   1. Enlace de Google Maps → se traen sus reseñas (Google solo da 5), o se
//      pegan a mano en el cuadro de texto (sin límite).
//   2. La IA propone frases literales clasificadas por tipo.
//   3. El gestor marca las que quiere y se añaden con fuente "Reseña de Google".

const estiloInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border-color)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

function Boton({ onClick, disabled, principal, children }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 14px', minHeight: 40, borderRadius: 10,
        border: principal ? 'none' : '1px solid var(--border-color)', whiteSpace: 'nowrap',
        background: disabled ? 'var(--bg-secondary)' : principal ? 'var(--accent-blue)' : 'var(--bg-card)',
        color: disabled ? 'var(--text-tertiary)' : principal ? 'white' : 'var(--text-primary)',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {children}
    </motion.button>
  )
}

export default function AnalizarResenasPanel({ cliente, guardando, onAnadir }) {
  const [enlace, setEnlace] = useState(cliente.googleMaps || '')
  const [texto, setTexto] = useState('')
  const [lugar, setLugar] = useState(null)
  const [trayendo, setTrayendo] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [propuestas, setPropuestas] = useState(null) // null = sin analizar; [] = sin resultados
  const [marcadas, setMarcadas] = useState(new Set())

  async function traer() {
    if (!enlace.trim() || trayendo) return
    setTrayendo(true)
    setAviso(null)
    try {
      const { lugar: l, resenas } = await obtenerResenasGoogle(enlace.trim())
      setLugar(l)
      if (!resenas.length) {
        setAviso('Google no devuelve reseñas con texto para este negocio. Puedes pegarlas abajo.')
      } else {
        setTexto(prev => [prev.trim(), ...resenas.map(r => r.texto)].filter(Boolean).join('\n\n'))
      }
    } catch (error) {
      setAviso(error.codigo === 'sin_clave'
        ? 'Traer reseñas por enlace aún no está activado. Abre la ficha del negocio en Google Maps, copia sus reseñas y pégalas abajo.'
        : mensajeErrorAmigable(error, 'No se han podido traer las reseñas. Inténtalo de nuevo o pégalas abajo.'))
    } finally {
      setTrayendo(false)
    }
  }

  async function analizar() {
    if (!texto.trim() || analizando) return
    setAnalizando(true)
    setAviso(null)
    try {
      const frases = await extraerVozDeResenas(cliente, texto)
      setPropuestas(frases)
      setMarcadas(new Set(frases.map((_, i) => i)))
      if (!frases.length) setAviso('No han salido frases útiles. Prueba con más reseñas o con reseñas más largas.')
    } catch (error) {
      setAviso(mensajeErrorAmigable(error, 'No se han podido analizar las reseñas. Inténtalo de nuevo.'))
    } finally {
      setAnalizando(false)
    }
  }

  function alternar(i) {
    setMarcadas(prev => {
      const siguiente = new Set(prev)
      if (siguiente.has(i)) siguiente.delete(i); else siguiente.add(i)
      return siguiente
    })
  }

  async function anadir() {
    const elegidas = propuestas.filter((_, i) => marcadas.has(i))
    if (!elegidas.length) return
    const ok = await onAnadir(elegidas.map(f => ({ ...f, fuente: 'Reseña de Google' })))
    if (ok) { setPropuestas(null); setMarcadas(new Set()); setTexto('') }
  }

  return (
    <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Enlace de Google Maps del negocio</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={enlace} onChange={e => setEnlace(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); traer() } }}
          placeholder="https://maps.app.goo.gl/..." aria-label="Enlace de Google Maps"
          style={{ ...estiloInput, flex: '1 1 300px' }} />
        <Boton onClick={traer} disabled={!enlace.trim() || trayendo}>
          <Link2 size={14} /> {trayendo ? 'Trayendo...' : 'Traer reseñas'}
        </Boton>
      </div>
      {lugar && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{lugar.nombre}</strong>
          {lugar.valoracion != null && <><Star size={12} fill="#F5A623" color="#F5A623" /> {lugar.valoracion}</>}
          {lugar.totalResenas != null && <span>· {lugar.totalResenas} reseñas en total; Google solo deja leer 5. Para más, pégalas abajo.</span>}
        </p>
      )}

      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '14px 0 8px' }}>Reseñas</p>
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5}
        placeholder="Pega aquí las reseñas (de Google, de su web, de TripAdvisor...), tal cual."
        aria-label="Texto de las reseñas"
        style={{ ...estiloInput, resize: 'vertical', lineHeight: 1.5 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Boton principal onClick={analizar} disabled={!texto.trim() || analizando}>
          <Sparkles size={14} /> {analizando ? 'Analizando...' : 'Sacar frases'}
        </Boton>
      </div>
      {aviso && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>{aviso}</p>}

      {propuestas?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            Frases encontradas: marca las que quieras guardar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {propuestas.map((f, i) => (
              <label key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                background: 'var(--bg-card)', border: `1px solid ${marcadas.has(i) ? 'rgba(29,95,224,0.35)' : 'var(--border-subtle)'}`,
              }}>
                <input type="checkbox" checked={marcadas.has(i)} onChange={() => alternar(i)} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {etiquetaTipoVoz(f.tipo)}
                  </span>
                  <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>“{f.texto}”</span>
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <Boton principal onClick={anadir} disabled={!marcadas.size || guardando}>
              {guardando ? 'Guardando...' : `Añadir ${marcadas.size} ${marcadas.size === 1 ? 'frase' : 'frases'}`}
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}
