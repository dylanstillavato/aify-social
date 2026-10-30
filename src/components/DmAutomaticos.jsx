import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, RefreshCw } from 'lucide-react'
import { Skeleton } from './Skeleton'
import {
  getDmAutomaticos, crearReglaDm, actualizarReglaDm, borrarReglaDm, getMediaInstagram, conectarInstagram,
} from '../services/instagram'
import { Tarjeta, Aviso, Chip } from './instagramUi'
import { botonPrimario, botonSecundario, textoSecundario, campoStyle, etiquetaCampo } from './instagramEstilos'

// DMs automáticos por palabra clave (paso Seguimiento): "Comenta GUIA y te lo
// mando por DM". Las reglas y el envío viven en el servidor
// (/api/instagram/dm/*); aquí solo se crean, editan y se ve el registro.

const MAX_PALABRA = 40
const MAX_MENSAJE = 1000
const MAX_RESPUESTA = 300

const ESTADOS_ENVIO = {
  enviado: { tono: 'ok', texto: 'Enviado' },
  omitido: { tono: 'neutro', texto: 'Omitido' },
  error: { tono: 'error', texto: 'Error' },
  pendiente: { tono: 'aviso', texto: 'Pendiente' },
}

const FORM_VACIO = { palabraClave: '', mensaje: '', respuestaPublica: '', media: null, disparador: 'comentario' }

// Dónde tiene que aparecer la palabra clave para que salte la regla.
const DISPARADORES = [
  ['comentario', 'En un comentario'],
  ['dm', 'En un DM'],
  ['ambos', 'En los dos'],
]
const TEXTO_DISPARADOR = { comentario: 'Comentarios', dm: 'DMs', ambos: 'Comentarios y DMs' }

function hace(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function Miniatura({ src, tipo, size = 36 }) {
  return src
    ? <img src={src} alt="" width={size} height={size} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: 8, background: 'var(--bg-secondary)', flexShrink: 0, fontSize: 9, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tipo || ''}</div>
}

function SelectorReel({ clienteId, seleccionado, onElegir }) {
  const [estado, setEstado] = useState(null) // { data?, error? }
  useEffect(() => {
    let activo = true
    getMediaInstagram(clienteId)
      .then(data => { if (activo) setEstado({ data }) })
      .catch(error => { if (activo) setEstado({ error }) })
    return () => { activo = false }
  }, [clienteId])

  if (!estado) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={72} borderRadius={8} />)}
      </div>
    )
  }
  if (estado.error) return <Aviso tono="error">{estado.error.message}</Aviso>
  const lista = estado.data.publicaciones || []
  if (lista.length === 0) return <p style={textoSecundario}>Esta cuenta todavía no tiene publicaciones.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
      {lista.map(m => {
        const activo = seleccionado?.id === m.id
        return (
          <button key={m.id} type="button" onClick={() => onElegir(m)} title={m.texto || m.tipo}
            style={{ padding: 0, border: activo ? '2px solid var(--text-primary)' : '2px solid transparent', borderRadius: 10, background: 'none', cursor: 'pointer', aspectRatio: '1', overflow: 'hidden' }}>
            {m.miniatura
              ? <img src={m.miniatura} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--bg-secondary)', fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.tipo}</div>}
          </button>
        )
      })}
    </div>
  )
}

function FormularioRegla({ clienteId, inicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(inicial)
  const [paraReel, setParaReel] = useState(Boolean(inicial.media))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.palabraClave.trim() || !form.mensaje.trim()) return setError('Pon la palabra clave y el mensaje.')
    const conReel = paraReel && form.disparador !== 'dm'
    if (conReel && !form.media) return setError('Elige el reel al que se aplica la regla.')
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        ...form,
        media: conReel ? form.media : null,
        respuestaPublica: form.disparador === 'dm' ? '' : form.respuestaPublica,
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      {error && <Aviso tono="error">{error}</Aviso>}
      <label style={etiquetaCampo}>Palabra clave</label>
      <input style={{ ...campoStyle, background: 'var(--bg-card)', marginBottom: 4, textTransform: 'uppercase' }} value={form.palabraClave}
        onChange={cambiar('palabraClave')} maxLength={MAX_PALABRA} placeholder="GUIA" />
      <p style={{ ...textoSecundario, fontSize: 11, marginBottom: 14 }}>Da igual mayúsculas, tildes o emojis: "¡Guía! 🙌" también cuenta.</p>

      <label style={etiquetaCampo}>¿Dónde la escriben?</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {DISPARADORES.map(([valor, texto]) => (
          <button key={valor} type="button" onClick={() => setForm(f => ({ ...f, disparador: valor }))}
            style={{ ...botonSecundario, background: form.disparador === valor ? 'var(--text-primary)' : 'var(--bg-card)', color: form.disparador === valor ? 'var(--bg-card)' : 'var(--text-primary)' }}>
            {texto}
          </button>
        ))}
      </div>

      <label style={etiquetaCampo}>Mensaje por DM</label>
      <textarea style={{ ...campoStyle, background: 'var(--bg-card)', minHeight: 90, resize: 'vertical' }} value={form.mensaje}
        onChange={cambiar('mensaje')} maxLength={MAX_MENSAJE}
        placeholder="¡Hola! Aquí tienes la guía que pediste 👉 https://…" />
      <p style={{ ...textoSecundario, fontSize: 11, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
        <span>Incluye el enlace al recurso: es el único mensaje que Instagram deja mandar.</span>
        <span>{form.mensaje.length}/{MAX_MENSAJE}</span>
      </p>

      {form.disparador !== 'dm' && (
        <>
          <label style={etiquetaCampo}>Respuesta pública al comentario <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
          <input style={{ ...campoStyle, background: 'var(--bg-card)', marginBottom: 14 }} value={form.respuestaPublica}
            onChange={cambiar('respuestaPublica')} maxLength={MAX_RESPUESTA} placeholder="¡Te lo he mandado por DM! 📩" />

          <label style={etiquetaCampo}>¿En qué publicaciones?</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[[false, 'Todas las publicaciones'], [true, 'Un reel concreto']].map(([valor, texto]) => (
              <button key={texto} type="button" onClick={() => setParaReel(valor)}
                style={{ ...botonSecundario, background: paraReel === valor ? 'var(--text-primary)' : 'var(--bg-card)', color: paraReel === valor ? 'var(--bg-card)' : 'var(--text-primary)' }}>
                {texto}
              </button>
            ))}
          </div>
          {paraReel && (
            <div style={{ marginBottom: 14 }}>
              <SelectorReel clienteId={clienteId} seleccionado={form.media} onElegir={(m) => setForm(f => ({ ...f, media: m }))} />
            </div>
          )}
          {paraReel && form.disparador === 'ambos' && (
            <p style={{ ...textoSecundario, fontSize: 11, marginBottom: 14 }}>Una regla de un reel concreto solo salta con comentarios en ese reel, no por DM.</p>
          )}
        </>
      )}
      {form.disparador === 'dm' && (
        <p style={{ ...textoSecundario, fontSize: 11, marginBottom: 14 }}>Salta cuando alguien te escribe la palabra clave por mensaje directo. Una vez por persona.</p>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" style={botonSecundario} onClick={onCancelar}>Cancelar</button>
        <button type="submit" style={{ ...botonPrimario, opacity: guardando ? 0.7 : 1 }} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar regla'}
        </button>
      </div>
    </form>
  )
}

function reglaAForm(regla) {
  return {
    palabraClave: regla.palabra_clave,
    mensaje: regla.mensaje,
    respuestaPublica: regla.respuesta_publica || '',
    disparador: regla.disparador || 'comentario',
    media: regla.media_id
      ? { id: regla.media_id, enlace: regla.media_permalink, miniatura: regla.media_miniatura, texto: regla.media_texto }
      : null,
  }
}

export default function DmAutomaticos({ clienteId }) {
  const [recarga, setRecarga] = useState(0)
  const clave = `${clienteId}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [editando, setEditando] = useState(null) // null | 'nueva' | regla.id
  const [errorAccion, setErrorAccion] = useState(null)

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    getDmAutomaticos(clienteId)
      .then(data => { if (activo) setEstado({ clave, data }) })
      .catch(error => { if (activo) setEstado({ clave, error }) })
    return () => { activo = false }
  }, [clienteId, clave])

  const actual = estado?.clave === clave ? estado : null
  const recargar = () => setRecarga(r => r + 1)

  const guardar = async (form) => {
    if (editando === 'nueva') await crearReglaDm(clienteId, form)
    else await actualizarReglaDm(clienteId, editando, form)
    setEditando(null)
    recargar()
  }

  const accion = async (fn) => {
    setErrorAccion(null)
    try {
      await fn()
      recargar()
    } catch (err) {
      setErrorAccion(err.message)
    }
  }

  const titulo = 'DMs automáticos'
  if (!actual) {
    return (
      <Tarjeta titulo={titulo}>
        <Skeleton height={14} style={{ marginBottom: 8 }} />
        <Skeleton height={14} width="60%" />
      </Tarjeta>
    )
  }
  if (actual.error) {
    return (
      <Tarjeta titulo={titulo}>
        <Aviso tono="error">{actual.error.message}</Aviso>
        <button type="button" style={botonSecundario} onClick={recargar}><RefreshCw size={13} /> Reintentar</button>
      </Tarjeta>
    )
  }

  const { conectado, permisosOk, reglas, envios } = actual.data
  const porId = Object.fromEntries(reglas.map(r => [r.id, r]))

  return (
    <Tarjeta titulo={titulo} accion={editando === null && permisosOk && (
      <button type="button" style={botonSecundario} onClick={() => setEditando('nueva')}><Plus size={13} /> Nueva regla</button>
    )}>
      <p style={{ ...textoSecundario, marginBottom: 14 }}>
        Cuando alguien comenta o te escribe por DM la palabra clave, le llega este mensaje. Instagram permite un solo mensaje por comentario y en los 7 días siguientes.
      </p>

      {!permisosOk && (
        <>
          <Aviso tono="aviso">
            {conectado
              ? 'Vuelve a conectar Instagram para activar los DMs automáticos: hacen falta permisos nuevos.'
              : 'Conecta el Instagram de este cliente para activar los DMs automáticos.'}
          </Aviso>
          <button type="button" style={{ ...botonPrimario, marginBottom: 14 }} onClick={() => accion(() => conectarInstagram(clienteId))}>
            {conectado ? 'Volver a conectar Instagram' : 'Conectar Instagram'}
          </button>
        </>
      )}
      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}

      {editando !== null && (
        <FormularioRegla
          key={editando}
          clienteId={clienteId}
          inicial={editando === 'nueva' ? FORM_VACIO : reglaAForm(porId[editando])}
          onGuardar={guardar}
          onCancelar={() => setEditando(null)}
        />
      )}

      {reglas.length === 0 && editando === null && permisosOk && (
        <p style={{ ...textoSecundario, marginBottom: 4 }}>Todavía no hay reglas. Crea una con la palabra clave del CTA del reel.</p>
      )}

      {reglas.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--border-subtle)', opacity: r.activa ? 1 : 0.55 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', padding: '2px 10px', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {r.palabra_clave.toUpperCase()}
              </span>
              <Chip tono={r.activa ? 'ok' : 'neutro'}>{r.activa ? 'Activa' : 'Pausada'}</Chip>
              <Chip>{TEXTO_DISPARADOR[r.disparador] || TEXTO_DISPARADOR.comentario}</Chip>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.enviados} {r.enviados === 1 ? 'enviado' : 'enviados'}</span>
            </div>
            <p style={{ ...textoSecundario, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.mensaje}</p>
            {r.respuesta_publica && (
              <p style={{ ...textoSecundario, fontSize: 11 }}>En público: “{r.respuesta_publica}”</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
              {r.media_id ? (
                <>
                  <Miniatura src={r.media_miniatura} tipo="Reel" size={22} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{r.media_texto || 'Reel concreto'}</span>
                  {r.media_permalink && (
                    <a href={r.media_permalink} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'inline-flex' }} aria-label="Ver en Instagram">
                      <ExternalLink size={11} />
                    </a>
                  )}
                </>
              ) : <span>{r.disparador === 'dm' ? 'Cualquier DM' : 'Todas las publicaciones'}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button type="button" style={botonSecundario} onClick={() => accion(() => actualizarReglaDm(clienteId, r.id, { activa: !r.activa }))}>
              {r.activa ? 'Pausar' : 'Activar'}
            </button>
            <button type="button" style={botonSecundario} onClick={() => setEditando(r.id)} aria-label="Editar regla"><Pencil size={13} /></button>
            <button type="button" style={botonSecundario} aria-label="Borrar regla"
              onClick={() => { if (window.confirm(`¿Borrar la regla ${r.palabra_clave.toUpperCase()}?`)) accion(() => borrarReglaDm(clienteId, r.id)) }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {envios.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Últimas activaciones</p>
          {envios.map(e => {
            const est = ESTADOS_ENVIO[e.estado] || ESTADOS_ENVIO.pendiente
            const regla = porId[e.regla_id]
            return (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border-subtle)', fontSize: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{e.ig_from_username || 'usuario'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}> · {e.origen === 'dm' ? 'DM: ' : ''}{e.texto_comentario}</span>
                  {e.error && <div style={{ fontSize: 11, color: e.estado === 'error' ? '#C4271D' : 'var(--text-secondary)' }}>{e.error}</div>}
                </div>
                {regla && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{regla.palabra_clave.toUpperCase()}</span>}
                <Chip tono={est.tono}>{est.texto}</Chip>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{hace(e.creado_en)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Tarjeta>
  )
}
