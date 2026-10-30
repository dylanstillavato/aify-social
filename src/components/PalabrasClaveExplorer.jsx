import { useState } from 'react'
import { Search, Sparkles, Lock, Loader2, Copy, Check } from 'lucide-react'
import { SKY_DEEP, LIME, INK, INK_SOFT, INK_FAINT, SURFACE, SURFACE_ALT, FONT, SIGNUP_URL, RED } from '../pages/marketing/shared'
import { investigarPalabrasClave, generarContenidoKeyword } from '../services/palabrasClave'

// Explorador de palabras clave — el mismo componente lo usan dos páginas:
// - /palabras-clave (pública, sin login): pasa `publico` y `maxGratis`, la
//   lista se corta y "Generar contenido" enlaza al registro en vez de
//   llamar a la IA.
// - /investigacion-palabras-clave (dashboard):
//   sin límite, "Generar contenido" sí llama a la IA de verdad.
// Ver src/services/palabrasClave.js para las dos llamadas al backend.

function tamañoBurbuja(valor) {
  const clamped = Math.max(30, Math.min(100, valor || 50))
  return 13 + ((clamped - 30) / 70) * 13
}

function KeywordBubble({ kw, onClick, activo }) {
  const size = tamañoBurbuja(kw.valor)
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${8 + size * 0.15}px ${14 + size * 0.25}px`, borderRadius: 999,
        border: activo ? `1.5px solid ${SKY_DEEP}` : '1.5px solid rgba(11,11,15,0.12)',
        background: activo ? `${SKY_DEEP}14` : SURFACE, fontSize: size, fontWeight: 600,
        color: activo ? SKY_DEEP : INK, fontFamily: FONT, cursor: 'pointer', lineHeight: 1.2,
      }}
    >
      {kw.query}
    </button>
  )
}

export default function PalabrasClaveExplorer({ publico = false, maxGratis = 8 }) {
  const [input, setInput] = useState('')
  const [estado, setEstado] = useState('idle') // idle | cargando | listo | error
  const [errorMsg, setErrorMsg] = useState('')
  const [resultado, setResultado] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)
  const [contenido, setContenido] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [errorContenido, setErrorContenido] = useState('')
  const [copiado, setCopiado] = useState(false)

  const buscar = async (e) => {
    e.preventDefault()
    if (!input.trim() || estado === 'cargando') return
    setEstado('cargando')
    setErrorMsg('')
    setSeleccionada(null)
    setContenido(null)
    try {
      const data = await investigarPalabrasClave(input.trim())
      setResultado(data)
      setEstado('listo')
    } catch (err) {
      setErrorMsg(err.message || 'Algo falló buscando palabras clave')
      setEstado('error')
    }
  }

  const seleccionarKeyword = (kw) => {
    setSeleccionada(kw)
    setContenido(null)
    setErrorContenido('')
    setCopiado(false)
  }

  const handleGenerarContenido = async () => {
    if (!seleccionada) return
    setGenerando(true)
    setErrorContenido('')
    try {
      const data = await generarContenidoKeyword(seleccionada.query, resultado?.negocio)
      setContenido(data)
    } catch (err) {
      setErrorContenido(err.message || 'No se pudo generar el contenido')
    } finally {
      setGenerando(false)
    }
  }

  const copiarCaption = () => {
    if (!contenido?.caption) return
    navigator.clipboard?.writeText(contenido.caption).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const keywords = resultado?.keywords || []
  const visibles = publico ? keywords.slice(0, maxGratis) : keywords
  const ocultas = publico ? Math.max(0, keywords.length - maxGratis) : 0

  return (
    <div style={{ width: '100%' }}>
      <style>{'.spin{animation:aify-spin 1s linear infinite}@keyframes aify-spin{to{transform:rotate(360deg)}}'}</style>
      <form onSubmit={buscar} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tu sitio web, @instagram, o describe tu negocio"
          style={{
            flex: '1 1 320px', padding: '15px 18px', borderRadius: 14,
            border: '1.5px solid rgba(11,11,15,0.15)', fontSize: 15.5, fontFamily: FONT,
            color: INK, outline: 'none', background: SURFACE,
          }}
        />
        <button
          type="submit"
          disabled={estado === 'cargando'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '15px 26px', borderRadius: 14,
            border: 'none', background: LIME, fontSize: 15, fontWeight: 700, color: INK,
            cursor: estado === 'cargando' ? 'not-allowed' : 'pointer', fontFamily: FONT,
            opacity: estado === 'cargando' ? 0.7 : 1, whiteSpace: 'nowrap',
          }}
        >
          {estado === 'cargando'
            ? <><Loader2 size={16} className="spin" /> Buscando…</>
            : <><Search size={16} /> Buscar palabras clave</>}
        </button>
      </form>

      {estado === 'error' && (
        <p style={{ color: RED, fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
      )}

      {estado === 'listo' && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: INK_FAINT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Todo lo que busca la gente sobre
            </span>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: INK, marginTop: 4 }}>
              {resultado.negocio} <span style={{ color: INK_FAINT, fontWeight: 500, fontSize: 15 }}>· {resultado.sector}</span>
            </h3>
          </div>

          {visibles.length === 0 && (
            <p style={{ color: INK_SOFT, fontSize: 14.5 }}>No encontramos palabras clave para eso — prueba describiéndolo de otra forma.</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: ocultas > 0 ? 14 : 28 }}>
            {visibles.map((kw, i) => (
              <KeywordBubble key={i} kw={kw} activo={seleccionada?.query === kw.query} onClick={() => seleccionarKeyword(kw)} />
            ))}
          </div>

          {ocultas > 0 && (
            <a href={SIGNUP_URL} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderRadius: 14,
              background: SURFACE_ALT, border: '1px dashed rgba(11,11,15,0.18)', textDecoration: 'none',
              marginBottom: 28, fontSize: 14, fontWeight: 600, color: INK_SOFT, fontFamily: FONT,
            }}>
              <Lock size={15} /> +{ocultas} palabras clave más · Regístrate gratis para verlas todas
            </a>
          )}

          {seleccionada && (
            <div style={{ padding: '24px 26px', borderRadius: 18, background: INK }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>{seleccionada.query}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {seleccionada.fuente === 'trends' ? 'Búsqueda real relacionada' : 'Estimado por IA'}
                </span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                  <span>Interés relativo</span>
                  <span>{Math.round(seleccionada.valor)}/100</span>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, seleccionada.valor)}%`, background: LIME, borderRadius: 4 }} />
                </div>
              </div>

              {publico ? (
                <a href={SIGNUP_URL} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 12,
                  background: LIME, fontSize: 14.5, fontWeight: 700, color: INK, textDecoration: 'none', fontFamily: FONT,
                }}>
                  <Sparkles size={15} /> Crear cuenta gratis para generar contenido
                </a>
              ) : (
                <>
                  {!contenido && (
                    <button
                      onClick={handleGenerarContenido}
                      disabled={generando}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 12,
                        border: 'none', background: LIME, fontSize: 14.5, fontWeight: 700, color: INK,
                        cursor: generando ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: generando ? 0.7 : 1,
                      }}
                    >
                      {generando ? <><Loader2 size={15} className="spin" /> Generando…</> : <><Sparkles size={15} /> Generar contenido con esta palabra</>}
                    </button>
                  )}
                  {errorContenido && <p style={{ color: '#FF8A80', fontSize: 13.5, marginTop: 12 }}>{errorContenido}</p>}
                  {contenido && (
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{contenido.formato}</span>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'white', marginTop: 8, lineHeight: 1.4 }}>{contenido.hook}</p>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 10, lineHeight: 1.5 }}>{contenido.idea}</p>
                      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, margin: 0 }}>{contenido.caption}</p>
                        <button onClick={copiarCaption} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiado ? LIME : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                          {copiado ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
