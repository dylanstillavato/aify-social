import { useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Upload, Trash2, Plus, Sparkles, Check, X,
  ExternalLink, Image as ImageIcon, Palette, Music, Link2, CalendarDays, BookOpen, AlertCircle,
} from 'lucide-react'
import {
  useInvestigacion, useFechasMarcadas, useUrlsMoodboard,
  subirImagenMoodboard, eliminarImagenMoodboard, crearFechasMarcadas, eliminarFechaMarcada,
  MOODBOARD_TIPOS,
} from '../hooks/useInvestigacion'
import { actualizarCliente } from '../hooks/useClientes'
import { analizarReferencias, sugerirFechasSector } from '../services/ai'
import { esHexValido, normalizarHex, colorTextoLegible } from '../utils/colorMarca'
import { mensajeErrorAmigable } from '../utils/errorMessage'

// Investigación mensual del cliente: un "onboarding interno" que se repite
// cada mes (moodboard, paleta y tipografías, música, referencias con análisis
// de IA y fechas clave del sector). Todo es interno y se guarda en
// investigaciones.datos (jsonb) con autosave; las fechas elegidas van a
// fechas_marcadas para que el calendario del cliente las muestre fijadas.
//
// Uso: <InvestigacionCliente cliente={cliente} onClienteActualizado={setCliente} />
//   cliente               → objeto de mapearCliente() (useClientes.js)
//   onClienteActualizado  → opcional; recibe el cliente actualizado cuando se
//                           guardan los colores en el kit de marca.

const MAX_COLORES = 6
const MESES_SUGERENCIAS = 2 // la IA sugiere fechas del mes y el siguiente

// ── Estilos compartidos ───────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #86868B)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
}

const botonSecundario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
}

const botonPrimario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: 'none',
  background: '#1D5FE0', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap',
}

const botonIcono = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)', cursor: 'pointer',
}

const textoAyuda = { fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }
const textoError = { fontSize: 12, color: '#FF3B30', margin: '8px 0 0' }

// ── Helpers puros ─────────────────────────────────────────────────────────────

function nombreMes(anio, mes) {
  const s = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatearFecha(iso) {
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Solo se enlazan URLs http(s): evita javascript: y similares en un <a href>
function urlSegura(valor) {
  const v = String(valor || '').trim()
  if (!v) return null
  const conProtocolo = /^https?:\/\//i.test(v) ? v : (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(v) ? `https://${v}` : null)
  if (!conProtocolo) return null
  try { return new URL(conProtocolo).href } catch { return null }
}

function paletaInicial(iv = {}) {
  return [iv.colorPrimario, iv.colorSecundario, iv.colorAcento].map(normalizarHex).filter(Boolean)
}

function tipografiasIniciales(iv = {}) {
  return [iv.fuenteEspecifica, iv.estiloTipografia].map(t => (t || '').trim()).filter(Boolean).slice(0, 1)
}

const mismaFecha = (a, b) => a.fecha === b.fecha && a.titulo.trim().toLowerCase() === b.titulo.trim().toLowerCase()

// ── Piezas de UI ──────────────────────────────────────────────────────────────

function Tarjeta({ icono: Icono, titulo, descripcion, accion, children, ...rest }) {
  return (
    <section
      {...rest}
      style={{
        background: 'var(--bg-card)', borderRadius: 18, padding: 22,
        border: '1px solid var(--border-subtle)', ...rest.style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(29,95,224,0.1)', color: '#1D5FE0',
          }}>
            <Icono size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '5px 0 2px' }}>{titulo}</h3>
            {descripcion && <p style={textoAyuda}>{descripcion}</p>}
          </div>
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

function IndicadorGuardado({ guardado, onReintentar }) {
  if (guardado === 'pendiente' || guardado === 'guardando') {
    return <span style={{ fontSize: 12, color: 'var(--text-tertiary, #86868B)' }}>Guardando…</span>
  }
  if (guardado === 'guardado') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#30D158' }}>
        <Check size={13} /> Guardado
      </span>
    )
  }
  if (guardado === 'error') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#FF3B30' }}>
        <AlertCircle size={13} /> No se pudo guardar
        <button type="button" onClick={onReintentar} style={{ ...botonSecundario, padding: '3px 8px', fontSize: 11 }}>Reintentar</button>
      </span>
    )
  }
  return null
}

// ── Moodboard ─────────────────────────────────────────────────────────────────

function SeccionMoodboard({ cliente, items, setDatos, subiendo, setSubiendo }) {
  const inputRef = useRef(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [errores, setErrores] = useState([])
  const [confirmarId, setConfirmarId] = useState(null)
  const [borrandoId, setBorrandoId] = useState(null)
  const srcPorId = useUrlsMoodboard(items)

  const subir = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length || subiendo) return
    setErrores([])
    const fallos = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!MOODBOARD_TIPOS.includes(file.type)) {
        fallos.push(`"${file.name}": formato no admitido (JPG, PNG o WebP)`)
        continue
      }
      setSubiendo({ actual: i + 1, total: files.length })
      try {
        const item = await subirImagenMoodboard({ clienteId: cliente.id, file })
        setDatos(d => ({ ...d, moodboard: [...(d.moodboard || []), item] }))
      } catch (err) {
        fallos.push(`"${file.name}": ${mensajeErrorAmigable(err, 'no se pudo subir')}`)
      }
    }
    setSubiendo(null)
    setErrores(fallos)
  }

  const borrar = async (item) => {
    setBorrandoId(item.id)
    const { error } = await eliminarImagenMoodboard(item)
    setBorrandoId(null)
    setConfirmarId(null)
    if (error) {
      setErrores([mensajeErrorAmigable(error, 'No se pudo quitar la imagen')])
      return
    }
    setDatos(d => ({ ...d, moodboard: (d.moodboard || []).filter(i => i.id !== item.id) }))
  }

  const setCaption = (id, caption) => {
    setDatos(d => ({ ...d, moodboard: (d.moodboard || []).map(i => (i.id === id ? { ...i, caption } : i)) }))
  }

  return (
    <Tarjeta
      icono={ImageIcon}
      titulo="Moodboard"
      descripcion="Imágenes de referencia visual para este mes. JPG, PNG o WebP, hasta 5 MB cada una."
      accion={(
        <button type="button" style={botonSecundario} disabled={!!subiendo} onClick={() => inputRef.current?.click()}>
          <Upload size={13} /> {subiendo ? `Subiendo ${subiendo.actual} de ${subiendo.total}…` : 'Subir imágenes'}
        </button>
      )}
      onDragOver={e => { e.preventDefault(); if (!arrastrando) setArrastrando(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setArrastrando(false) }}
      onDrop={e => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files) }}
      style={arrastrando ? { borderColor: '#1D5FE0', boxShadow: '0 0 0 3px rgba(29,95,224,0.15)' } : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MOODBOARD_TIPOS.join(',')}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files; subir(f); e.target.value = '' }}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!subiendo}
          style={{
            width: '100%', padding: '32px 16px', borderRadius: 14, cursor: 'pointer',
            border: '1px dashed var(--border-color, var(--border-subtle))', background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          <Upload size={18} />
          Arrastra imágenes aquí o haz clic para elegirlas
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {items.map(item => {
            const src = srcPorId[item.id]
            const confirmando = confirmarId === item.id
            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                }}>
                  {src
                    ? <img src={src} alt={item.caption || 'Imagen del moodboard'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-tertiary, #86868B)' }}>Cargando…</div>}
                  {!confirmando && (
                    <button
                      type="button"
                      title="Quitar imagen"
                      onClick={() => setConfirmarId(item.id)}
                      style={{ ...botonIcono, position: 'absolute', top: 6, right: 6, width: 26, height: 26, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {confirmando && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <button
                        type="button"
                        disabled={borrandoId === item.id}
                        onClick={() => borrar(item)}
                        style={{ ...botonPrimario, background: '#FF3B30', fontSize: 12, padding: '6px 12px' }}
                      >
                        <Trash2 size={13} /> {borrandoId === item.id ? 'Quitando…' : 'Quitar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmarId(null)}
                        style={{ background: 'none', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={item.caption || ''}
                  placeholder="Añadir nota (opcional)"
                  onChange={e => setCaption(item.id, e.target.value)}
                  style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
                />
              </div>
            )
          })}
        </div>
      )}
      {errores.map((e, i) => <p key={i} style={textoError}>{e}</p>)}
    </Tarjeta>
  )
}

// ── Colores y tipografía ──────────────────────────────────────────────────────

function SeccionColores({ cliente, datos, setDatos, onClienteActualizado }) {
  const iv = cliente.identidadVisual || {}
  const paleta = Array.isArray(datos.paleta) ? datos.paleta : paletaInicial(iv)
  const tipografias = Array.isArray(datos.tipografias) ? datos.tipografias : tipografiasIniciales(iv)
  const [nuevaTipo, setNuevaTipo] = useState('')
  const [kit, setKit] = useState({ estado: 'idle', error: null }) // idle | guardando | ok | error

  const setPaleta = (fn) => {
    setDatos(d => ({ ...d, paleta: fn(Array.isArray(d.paleta) ? d.paleta : paletaInicial(iv)) }))
    if (kit.estado !== 'idle') setKit({ estado: 'idle', error: null })
  }
  const setTipografias = (fn) => {
    setDatos(d => ({ ...d, tipografias: fn(Array.isArray(d.tipografias) ? d.tipografias : tipografiasIniciales(iv)) }))
  }

  const anadirTipo = () => {
    const t = nuevaTipo.trim()
    if (!t) return
    setTipografias(l => (l.some(x => x.toLowerCase() === t.toLowerCase()) ? l : [...l, t]))
    setNuevaTipo('')
  }

  const guardarEnKit = async () => {
    const validos = paleta.map(normalizarHex).filter(Boolean)
    if (!validos.length) {
      setKit({ estado: 'error', error: 'Añade al menos un color válido (ej. #1D5FE0)' })
      return
    }
    const nuevo = { ...iv }
    ;['colorPrimario', 'colorSecundario', 'colorAcento'].forEach((k, i) => { if (validos[i]) nuevo[k] = validos[i] })
    setKit({ estado: 'guardando', error: null })
    try {
      const actualizado = { ...cliente, identidadVisual: nuevo }
      const { data, error } = await actualizarCliente(cliente.id, actualizado)
      if (error) {
        setKit({ estado: 'error', error: mensajeErrorAmigable(error, 'No se pudo guardar en el kit de marca') })
        return
      }
      setKit({ estado: 'ok', error: null })
      onClienteActualizado?.(data || actualizado)
    } catch (err) {
      setKit({ estado: 'error', error: mensajeErrorAmigable(err, 'No se pudo guardar en el kit de marca') })
    }
  }

  return (
    <Tarjeta
      icono={Palette}
      titulo="Colores y tipografía"
      descripcion={`Hasta ${MAX_COLORES} colores. Los tres primeros se pueden llevar al kit de marca como primario, secundario y acento.`}
    >
      <div style={labelStyle}>Paleta</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {paleta.map((valor, idx) => {
          const hex = normalizarHex(valor)
          const invalido = !!valor && !esHexValido(valor)
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: 6, paddingRight: 8, borderRadius: 12,
              border: `1px solid ${invalido ? '#FF3B30' : 'var(--border-subtle)'}`,
            }}>
              <label title="Elegir color" style={{
                position: 'relative', width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
                background: hex || 'var(--bg-secondary)', border: '1px solid rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, color: hex ? colorTextoLegible(hex) : 'var(--text-secondary)',
              }}>
                {idx < 3 ? ['P', 'S', 'A'][idx] : ''}
                <input
                  type="color"
                  value={hex || '#000000'}
                  onChange={e => setPaleta(p => p.map((c, i) => (i === idx ? e.target.value : c)))}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </label>
              <input
                type="text"
                value={valor}
                placeholder="#000000"
                spellCheck={false}
                onChange={e => setPaleta(p => p.map((c, i) => (i === idx ? e.target.value : c)))}
                style={{
                  width: 76, fontSize: 13, fontFamily: 'monospace', padding: 0,
                  border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                title="Quitar color"
                onClick={() => setPaleta(p => p.filter((_, i) => i !== idx))}
                style={{ ...botonIcono, width: 24, height: 24, border: 'none', background: 'transparent' }}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
        {paleta.length < MAX_COLORES && (
          <button
            type="button"
            onClick={() => setPaleta(p => [...p, '#1d5fe0'])}
            style={{ ...botonSecundario, minHeight: 48, borderStyle: 'dashed' }}
          >
            <Plus size={13} /> Añadir color
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button type="button" style={botonSecundario} onClick={guardarEnKit} disabled={kit.estado === 'guardando' || !paleta.length}>
          {kit.estado === 'guardando' ? 'Guardando…' : 'Guardar también en el kit de marca'}
        </button>
        {kit.estado === 'ok' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#30D158' }}>
            <Check size={13} /> Kit de marca actualizado
          </span>
        )}
        {kit.error && <span style={{ fontSize: 12, color: '#FF3B30' }}>{kit.error}</span>}
      </div>

      <div style={labelStyle}>Tipografías</div>
      {tipografias.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {tipografias.map((t, idx) => (
            <span key={`${t}-${idx}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 6px 5px 12px',
              borderRadius: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
            }}>
              {t}
              <button
                type="button"
                title="Quitar tipografía"
                onClick={() => setTipografias(l => l.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex' }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <form
        onSubmit={e => { e.preventDefault(); anadirTipo() }}
        style={{ display: 'flex', gap: 8, maxWidth: 440 }}
      >
        <input
          type="text"
          value={nuevaTipo}
          onChange={e => setNuevaTipo(e.target.value)}
          placeholder="Ej. Inter para textos, serif display para titulares"
          style={inputStyle}
        />
        <button type="submit" style={botonSecundario} disabled={!nuevaTipo.trim()}>
          <Plus size={13} /> Añadir
        </button>
      </form>
    </Tarjeta>
  )
}

// ── Listas editables (música, referencias) ────────────────────────────────────

function FilaEnlace({ principal, secundario, onCambiar, onQuitar, placeholderPrincipal, placeholderSecundario, campoEnlace }) {
  const enlace = urlSegura(campoEnlace === 'principal' ? principal : secundario)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={principal}
        onChange={e => onCambiar('principal', e.target.value)}
        placeholder={placeholderPrincipal}
        style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }}
      />
      <input
        type="text"
        value={secundario}
        onChange={e => onCambiar('secundario', e.target.value)}
        placeholder={placeholderSecundario}
        style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        {enlace && (
          <a href={enlace} target="_blank" rel="noopener noreferrer" title="Abrir enlace" style={{ ...botonIcono, textDecoration: 'none' }}>
            <ExternalLink size={14} />
          </a>
        )}
        <button type="button" title="Quitar" onClick={onQuitar} style={botonIcono}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function SeccionMusica({ items, setDatos }) {
  const actualizar = (id, campo, valor) => setDatos(d => ({
    ...d, musica: (d.musica || []).map(m => (m.id === id ? { ...m, [campo]: valor } : m)),
  }))
  return (
    <Tarjeta
      icono={Music}
      titulo="Música y sonido"
      descripcion="Canciones, estilos o audios en tendencia que encajan con la marca este mes."
      accion={(
        <button
          type="button"
          style={botonSecundario}
          onClick={() => setDatos(d => ({ ...d, musica: [...(d.musica || []), { id: crypto.randomUUID(), texto: '', enlace: '' }] }))}
        >
          <Plus size={13} /> Añadir
        </button>
      )}
    >
      {items.length === 0
        ? <p style={textoAyuda}>Todavía no hay música apuntada para este mes.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(m => (
              <FilaEnlace
                key={m.id}
                principal={m.texto || ''}
                secundario={m.enlace || ''}
                campoEnlace="secundario"
                placeholderPrincipal="Canción, artista o estilo (ej. lo-fi suave, voz en off)"
                placeholderSecundario="Enlace (opcional)"
                onCambiar={(campo, v) => actualizar(m.id, campo === 'principal' ? 'texto' : 'enlace', v)}
                onQuitar={() => setDatos(d => ({ ...d, musica: (d.musica || []).filter(x => x.id !== m.id) }))}
              />
            ))}
          </div>
        )}
    </Tarjeta>
  )
}

function ListaAnalisis({ titulo, items }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={labelStyle}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((t, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{t}</li>)}
      </ul>
    </div>
  )
}

function SeccionReferencias({ cliente, items, analisis, setDatos }) {
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState(null)
  const hayContenido = items.some(r => (r.url || '').trim() || (r.nota || '').trim())

  const actualizar = (id, campo, valor) => setDatos(d => ({
    ...d, referencias: (d.referencias || []).map(r => (r.id === id ? { ...r, [campo]: valor } : r)),
  }))

  const analizar = async () => {
    setError(null)
    setAnalizando(true)
    try {
      const res = await analizarReferencias(cliente, items)
      setDatos(d => ({ ...d, analisis: { ...res, generadoEn: new Date().toISOString() } }))
    } catch (err) {
      setError(mensajeErrorAmigable(err, 'No se pudo analizar con IA'))
    } finally {
      setAnalizando(false)
    }
  }

  return (
    <Tarjeta
      icono={Link2}
      titulo="Referencias y ejemplos"
      descripcion="Competidores, cuentas que admira o vídeos concretos, con una nota de qué te interesa de cada uno."
      accion={(
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={botonSecundario}
            onClick={() => setDatos(d => ({ ...d, referencias: [...(d.referencias || []), { id: crypto.randomUUID(), url: '', nota: '' }] }))}
          >
            <Plus size={13} /> Añadir
          </button>
          <button type="button" style={{ ...botonPrimario, opacity: (!hayContenido || analizando) ? 0.6 : 1 }} disabled={!hayContenido || analizando} onClick={analizar}>
            <Sparkles size={14} /> {analizando ? 'Analizando…' : 'Analizar con IA'}
          </button>
        </div>
      )}
    >
      {items.length === 0
        ? <p style={textoAyuda}>Añade enlaces de Instagram, TikTok, YouTube o webs de la competencia.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(r => (
              <FilaEnlace
                key={r.id}
                principal={r.url || ''}
                secundario={r.nota || ''}
                campoEnlace="principal"
                placeholderPrincipal="https://instagram.com/…"
                placeholderSecundario="Qué te interesa (ritmo, formato, tono…)"
                onCambiar={(campo, v) => actualizar(r.id, campo === 'principal' ? 'url' : 'nota', v)}
                onQuitar={() => setDatos(d => ({ ...d, referencias: (d.referencias || []).filter(x => x.id !== r.id) }))}
              />
            ))}
          </div>
        )}
      {error && <p style={textoError}>{error}</p>}

      {!!(analisis && (analisis.tono || analisis.patrones?.length)) && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 14,
          background: 'rgba(29,95,224,0.06)', border: '1px solid rgba(29,95,224,0.18)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1D5FE0' }}>
              <Sparkles size={14} /> Análisis de la IA
            </span>
            {analisis.generadoEn && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #86868B)' }}>
                {new Date(analisis.generadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            La IA no ve los vídeos: deduce a partir de los enlaces, los nombres de las cuentas y tus notas.
          </p>
          {analisis.tono && (
            <>
              <div style={labelStyle}>Tono</div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>{analisis.tono}</p>
            </>
          )}
          <ListaAnalisis titulo="Patrones" items={analisis.patrones} />
          <ListaAnalisis titulo="Ideas de formato" items={analisis.ideas_formato} />
          <ListaAnalisis titulo="Qué evitar" items={analisis.que_evitar} />
        </div>
      )}
    </Tarjeta>
  )
}

// ── Fechas clave del sector ───────────────────────────────────────────────────

const ETIQUETA_ORIGEN = { onboarding: 'Onboarding', investigacion: 'Investigación', manual: 'Manual' }

function SeccionFechas({ cliente, anio, mes, sugeridas, setDatos }) {
  const { fechas: marcadas, cargando } = useFechasMarcadas(cliente.id, anio, mes, { meses: MESES_SUGERENCIAS })
  const [sugiriendo, setSugiriendo] = useState(false)
  const [ocupadas, setOcupadas] = useState({}) // clave -> true mientras se guarda/borra
  const [error, setError] = useState(null)
  const [manual, setManual] = useState({ fecha: '', titulo: '' })
  const [guardandoManual, setGuardandoManual] = useState(false)
  const ref = { clienteId: cliente.id, organizacionId: cliente.organizacionId }

  const sugerir = async () => {
    setError(null)
    setSugiriendo(true)
    try {
      const res = await sugerirFechasSector(cliente, anio, mes)
      setDatos(d => ({ ...d, fechasSugeridas: res }))
      if (!res.length) setError('La IA no encontró fechas fiables para estos meses. Prueba de nuevo o añádelas a mano.')
    } catch (err) {
      setError(mensajeErrorAmigable(err, 'No se pudieron sugerir fechas'))
    } finally {
      setSugiriendo(false)
    }
  }

  const marcar = (clave, on) => setOcupadas(o => {
    const n = { ...o }
    if (on) n[clave] = true
    else delete n[clave]
    return n
  })

  const toggleSugerida = async (s) => {
    const clave = `${s.fecha}|${s.titulo}`
    const existente = marcadas.find(m => mismaFecha(m, s))
    setError(null)
    marcar(clave, true)
    const { error: err } = existente
      ? await eliminarFechaMarcada(existente.id)
      : await crearFechasMarcadas(ref, [{ fecha: s.fecha, titulo: s.titulo, origen: 'investigacion', notas: s.motivo || null }])
    marcar(clave, false)
    if (err) setError(mensajeErrorAmigable(err, 'No se pudo actualizar la fecha'))
  }

  const quitar = async (f) => {
    setError(null)
    marcar(f.id, true)
    const { error: err } = await eliminarFechaMarcada(f.id)
    marcar(f.id, false)
    if (err) setError(mensajeErrorAmigable(err, 'No se pudo quitar la fecha'))
  }

  const anadirManual = async (e) => {
    e.preventDefault()
    const titulo = manual.titulo.trim()
    if (!manual.fecha || !titulo) return
    setError(null)
    setGuardandoManual(true)
    const { error: err } = await crearFechasMarcadas(ref, [{ fecha: manual.fecha, titulo, origen: 'manual' }])
    setGuardandoManual(false)
    if (err) { setError(mensajeErrorAmigable(err, 'No se pudo añadir la fecha')); return }
    setManual({ fecha: '', titulo: '' })
  }

  return (
    <Tarjeta
      icono={CalendarDays}
      titulo="Fechas clave del sector"
      descripcion={`Fechas de ${nombreMes(anio, mes).toLowerCase()} y el mes siguiente. Las que marques quedan fijadas en el calendario del cliente.`}
      accion={(
        <button type="button" style={{ ...botonPrimario, opacity: sugiriendo ? 0.6 : 1 }} disabled={sugiriendo} onClick={sugerir}>
          <Sparkles size={14} /> {sugiriendo ? 'Buscando fechas…' : 'Sugerir fechas con IA'}
        </button>
      )}
    >
      {sugeridas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={labelStyle}>Sugerencias de la IA</div>
          <p style={{ ...textoAyuda, marginBottom: 8 }}>Revisa cada fecha antes de marcarla: la IA puede equivocarse con las fechas móviles.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sugeridas.map(s => {
              const clave = `${s.fecha}|${s.titulo}`
              const marcada = marcadas.some(m => mismaFecha(m, s))
              const ocupada = !!ocupadas[clave]
              return (
                <label key={clave} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: ocupada ? 'wait' : 'pointer',
                  border: `1px solid ${marcada ? 'rgba(29,95,224,0.35)' : 'var(--border-subtle)'}`,
                  background: marcada ? 'rgba(29,95,224,0.06)' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={ocupada || cargando}
                    onChange={() => toggleSugerida(s)}
                    style={{ marginTop: 3, accentColor: '#1D5FE0' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      <span style={{ fontWeight: 600 }}>{formatearFecha(s.fecha)}</span> · {s.titulo}
                    </div>
                    {s.motivo && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{s.motivo}</div>}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div style={labelStyle}>Fechas marcadas</div>
      {cargando
        ? <p style={textoAyuda}>Cargando…</p>
        : marcadas.length === 0
          ? <p style={textoAyuda}>No hay fechas marcadas en estos dos meses.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {marcadas.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 12px', borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 96 }}>{formatearFecha(f.fecha)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{f.titulo}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  }}>{ETIQUETA_ORIGEN[f.origen] || f.origen}</span>
                  <button type="button" title="Quitar fecha" disabled={!!ocupadas[f.id]} onClick={() => quitar(f)} style={botonIcono}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

      <form onSubmit={anadirManual} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="date"
          value={manual.fecha}
          onChange={e => setManual(m => ({ ...m, fecha: e.target.value }))}
          style={{ ...inputStyle, width: 160 }}
        />
        <input
          type="text"
          value={manual.titulo}
          onChange={e => setManual(m => ({ ...m, titulo: e.target.value }))}
          placeholder="Nombre de la fecha (ej. aniversario del local)"
          style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }}
        />
        <button type="submit" style={botonSecundario} disabled={guardandoManual || !manual.fecha || !manual.titulo.trim()}>
          <Plus size={13} /> {guardandoManual ? 'Añadiendo…' : 'Añadir fecha'}
        </button>
      </form>
      {error && <p style={textoError}>{error}</p>}
    </Tarjeta>
  )
}

// ── Datos del onboarding (solo lectura) ───────────────────────────────────────

function BloqueTexto({ titulo, texto }) {
  if (!texto || !String(texto).trim()) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{titulo}</div>
      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{texto}</p>
    </div>
  )
}

function ListaVideos({ titulo, videos, campoNota, referencias, onAnadir }) {
  const lista = (videos || []).filter(v => v?.url)
  if (!lista.length) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lista.map((v, i) => {
          const enlace = urlSegura(v.url)
          const yaEsta = referencias.some(r => (r.url || '').trim() === v.url.trim())
          return (
            <div key={`${v.url}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 12px', borderRadius: 12,
              border: '1px solid var(--border-subtle)', flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                {enlace
                  ? <a href={enlace} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1D5FE0', wordBreak: 'break-all' }}>{v.label || v.url}</a>
                  : <span style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{v.label || v.url}</span>}
                {v[campoNota] && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{v[campoNota]}</div>}
              </div>
              {onAnadir && (
                <button type="button" style={botonSecundario} disabled={yaEsta} onClick={() => onAnadir(v)}>
                  {yaEsta ? <><Check size={13} /> En referencias</> : <><Plus size={13} /> Usar como referencia</>}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeccionOnboarding({ cliente, referencias, setDatos }) {
  const h = cliente.historial || {}
  const iv = cliente.identidadVisual || {}
  const hayAlgo = [h.queHaFuncionado, h.mejorPost, h.hashtagsPropio, h.referencias, iv.referenciaEstetica].some(t => t && String(t).trim())
    || (cliente.videosReferencia || []).some(v => v?.url)
    || (cliente.videosCliente || []).some(v => v?.url)
    || (iv.estetica || []).length > 0

  const anadirReferencia = (v) => setDatos(d => {
    const actuales = d.referencias || []
    if (actuales.some(r => (r.url || '').trim() === v.url.trim())) return d
    return { ...d, referencias: [...actuales, { id: crypto.randomUUID(), url: v.url, nota: v.queMeGusta || v.motivo || '' }] }
  })

  return (
    <Tarjeta
      icono={BookOpen}
      titulo="Datos del onboarding"
      descripcion="Lo que se recogió al dar de alta al cliente, para tenerlo a mano mientras investigas."
    >
      {!hayAlgo && <p style={textoAyuda}>Este cliente no tiene historial ni vídeos de referencia en su onboarding.</p>}
      <BloqueTexto titulo="Qué ha funcionado antes" texto={h.queHaFuncionado} />
      <BloqueTexto titulo="Mejor publicación o campaña" texto={h.mejorPost} />
      <BloqueTexto titulo="Cuentas que admira" texto={h.referencias} />
      <BloqueTexto titulo="Hashtags propios" texto={h.hashtagsPropio} />
      <BloqueTexto titulo="Referencia estética" texto={iv.referenciaEstetica} />
      {(iv.estetica || []).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Estética</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {iv.estetica.map(e => (
              <span key={e} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{e}</span>
            ))}
          </div>
        </div>
      )}
      <ListaVideos titulo="Vídeos de referencia" videos={cliente.videosReferencia} campoNota="queMeGusta" referencias={referencias} onAnadir={anadirReferencia} />
      <ListaVideos titulo="Vídeos del cliente" videos={cliente.videosCliente} campoNota="motivo" referencias={referencias} />
    </Tarjeta>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function InvestigacionCliente({ cliente, onClienteActualizado }) {
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
  })
  const [subiendo, setSubiendo] = useState(null)
  const { anio, mes } = periodo

  const { datos, cargando, errorCarga, setDatos, guardado } = useInvestigacion({
    clienteId: cliente?.id,
    organizacionId: cliente?.organizacionId,
    anio,
    mes,
  })

  if (!cliente?.id) return null

  const moverMes = (delta) => setPeriodo(({ anio: a, mes: m }) => {
    const d = new Date(a, m - 1 + delta, 1)
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
  })

  const lista = (v) => (Array.isArray(v) ? v : [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" title="Mes anterior" onClick={() => moverMes(-1)} disabled={!!subiendo} style={botonIcono}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth: 160, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{nombreMes(anio, mes)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #86868B)' }}>Investigación del mes</div>
          </div>
          <button type="button" title="Mes siguiente" onClick={() => moverMes(1)} disabled={!!subiendo} style={botonIcono}>
            <ChevronRight size={16} />
          </button>
        </div>
        <IndicadorGuardado guardado={guardado} onReintentar={() => setDatos(d => ({ ...d }))} />
      </div>

      {errorCarga && (
        <p style={{ ...textoError, margin: 0 }}>
          {mensajeErrorAmigable(errorCarga, 'No se pudo cargar la investigación de este mes')}
        </p>
      )}

      {errorCarga ? null : cargando ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)' }}>
          Cargando investigación…
        </div>
      ) : (
        <>
          <SeccionMoodboard cliente={cliente} items={lista(datos.moodboard)} setDatos={setDatos} subiendo={subiendo} setSubiendo={setSubiendo} />
          <SeccionColores cliente={cliente} datos={datos} setDatos={setDatos} onClienteActualizado={onClienteActualizado} />
          <SeccionMusica items={lista(datos.musica)} setDatos={setDatos} />
          <SeccionReferencias cliente={cliente} items={lista(datos.referencias)} analisis={datos.analisis || null} setDatos={setDatos} />
          <SeccionFechas cliente={cliente} anio={anio} mes={mes} sugeridas={lista(datos.fechasSugeridas)} setDatos={setDatos} />
          <SeccionOnboarding cliente={cliente} referencias={lista(datos.referencias)} setDatos={setDatos} />
        </>
      )}
    </div>
  )
}
