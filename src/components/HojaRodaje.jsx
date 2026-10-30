import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Download, Clapperboard, AlertCircle, Video, Images, Link2, Copy } from 'lucide-react'
import { agruparPlanos, agruparCarruseles, fechaCorta, claveStorageRodaje } from '../utils/hojaRodaje'
import { esCarrusel } from '../utils/formato'
import { exportarHojaRodaje } from '../services/exportPDF'
import { compartirHojaRodaje } from '../hooks/useHojaRodajeEnlace'
import { marcarPostGrabado } from '../hooks/useCalendario'

// Hoja de rodaje del mes: el gestor graba todos los vídeos del mes de un
// cliente en un solo día en su local. Aquí ve todos los planos agrupados por
// tipo (todos los primeros planos a cámara seguidos, luego los detalles...),
// los va marcando según los graba y apunta el material que tiene que llevar.
// Vídeos y carruseles van separados: los vídeos por tipo de plano y los
// carruseles uno a uno con la imagen de cada slide (las fotos que hay que hacer).
// Solo lectura respecto a la base de datos: el progreso y las notas viven en
// localStorage, por cliente y mes.
// Con `inline` se pinta como una tarjeta dentro de la página (paso Grabación
// de la ficha de cliente) en vez de como panel lateral; `open`/`onClose` no
// aplican en ese modo.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const VACIO = { marcados: {}, notas: '' }

function leer(clave) {
  try {
    const raw = localStorage.getItem(clave)
    if (!raw) return VACIO
    const data = JSON.parse(raw)
    return {
      marcados: data && typeof data.marcados === 'object' && data.marcados ? data.marcados : {},
      notas: typeof data?.notas === 'string' ? data.notas : '',
    }
  } catch {
    return VACIO
  }
}

function escribir(clave, estado) {
  try {
    const vacio = !Object.keys(estado.marcados).length && !estado.notas
    if (vacio) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(estado))
  } catch { /* almacenamiento bloqueado o lleno: se pierde al recargar, nada más */ }
}

function Interruptor({ activo, onChange, children }) {
  return (
    <button onClick={() => onChange(!activo)} role="switch" aria-checked={activo}
      style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)' }}>
      <span style={{ width: 34, height: 20, borderRadius: 10, background: activo ? '#1D5FE0' : 'var(--border-color)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: activo ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </span>
      {children}
    </button>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'baseline' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', width: 76, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function FilaPlano({ plano, grabado, onToggle, carrusel = false }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
      opacity: grabado ? 0.55 : 1, transition: 'opacity 0.15s',
    }}>
      <button onClick={onToggle} role="checkbox" aria-checked={grabado} title={grabado ? 'Marcar como pendiente' : 'Marcar como grabado'}
        style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: grabado ? 'none' : '1.5px solid var(--border-color)',
          background: grabado ? '#1D5FE0' : 'var(--bg-card)',
        }}>
        {grabado && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: grabado ? 'line-through' : 'none' }}>
            {plano.titulo}
          </span>
          {plano.fecha && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fechaCorta(plano.fecha)}</span>}
          {plano.segundos !== '' && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {plano.segundos}s</span>}
        </div>
        {carrusel ? (
          <>
            {plano.visual && <Campo label="Imagen">{plano.visual}</Campo>}
            {plano.dice && <Campo label="Texto">{plano.dice}</Campo>}
          </>
        ) : (
          <>
            {plano.visual && <Campo label="Se ve">{plano.visual}</Campo>}
            {plano.dice && <Campo label="Se dice"><span style={{ fontWeight: 500 }}>{`“${plano.dice}”`}</span></Campo>}
          </>
        )}
      </div>
    </div>
  )
}

export default function HojaRodaje({ open, onClose, cliente, piezas, videos: piezasAntiguas, año, mes, inline = false }) {
  const todas = piezas || piezasAntiguas || []
  const videos = todas.filter(p => !esCarrusel(p))
  const carruseles = todas.filter(esCarrusel)
  const clave = claveStorageRodaje(cliente?.id, año, mes)
  // El padre remonta este componente al cambiar de cliente o mes (key), así
  // que basta con leer localStorage al montar.
  const [estado, setEstado] = useState(() => leer(clave))
  // null = automático: activado si hay algún guion aprobado. Se deriva en
  // render para que funcione aunque los vídeos lleguen después de montar.
  const [soloAprobadosManual, setSoloAprobadosManual] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState(null)
  // Enlace /rodaje/<token>: la hoja vídeo a vídeo para quien graba
  const [enlace, setEnlace] = useState(null) // { url, copiado }
  const [compartiendo, setCompartiendo] = useState(false)

  const hayAprobados = todas.some(p => p.aprobacionEstado === 'aprobado' && p.guion?.planos?.length)
  const soloAprobados = soloAprobadosManual ?? hayAprobados
  const grupos = agruparPlanos(videos, { soloAprobados })
  const gruposCarrusel = agruparCarruseles(carruseles, { soloAprobados })
  const todosGrupos = [...grupos, ...gruposCarrusel]
  const totalPlanos = grupos.reduce((s, g) => s + g.planos.length, 0)
  const totalSlides = gruposCarrusel.reduce((s, g) => s + g.planos.length, 0)
  const totalVideos = new Set(grupos.flatMap(g => g.planos.map(p => p.postId))).size
  const total = totalPlanos + totalSlides
  // Vídeo grabado (post.grabadoEn, 0036): lo marca también quien graba desde
  // el enlace /rodaje, y entonces todos sus planos salen grabados aquí.
  // `cambiosGrabado` guarda lo que se cambia aquí hasta que el padre relee.
  const [cambiosGrabado, setCambiosGrabado] = useState({})
  const postGrabado = (postId) => cambiosGrabado[postId] ?? !!todas.find(p => String(p.id) === String(postId))?.grabadoEn
  const marcado = (p) => !!estado.marcados[p.key] || postGrabado(p.postId)
  const grabados = todosGrupos.reduce((s, g) => s + g.planos.filter(marcado).length, 0)

  const guardar = (siguiente) => { setEstado(siguiente); escribir(clave, siguiente) }
  const fijarGrabado = (postId, grabado) => {
    setCambiosGrabado(c => ({ ...c, [postId]: grabado }))
    marcarPostGrabado(cliente?.id, postId, grabado)
  }
  const toggle = (plano) => {
    const marcados = { ...estado.marcados }
    const delVideo = todosGrupos.flatMap(g => g.planos).filter(p => String(p.postId) === String(plano.postId))
    if (marcado(plano)) {
      // Desmarcar un plano de un vídeo grabado: el vídeo deja de estarlo y
      // el resto de sus planos siguen marcados
      if (postGrabado(plano.postId)) {
        delVideo.forEach(p => { marcados[p.key] = true })
        fijarGrabado(plano.postId, false)
      }
      delete marcados[plano.key]
    } else {
      marcados[plano.key] = true
      // Último plano del vídeo: queda grabado para todos (enlace incluido)
      if (delVideo.every(p => marcados[p.key])) fijarGrabado(plano.postId, true)
    }
    guardar({ ...estado, marcados })
  }
  const reiniciar = () => {
    todas.filter(p => postGrabado(p.id)).forEach(p => fijarGrabado(p.id, false))
    guardar({ ...estado, marcados: {} })
  }

  useEffect(() => {
    if (!open || inline) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, inline])

  const exportar = async () => {
    setExportando(true); setError(null)
    try {
      const marcar = gs => gs.map(g => ({ ...g, planos: g.planos.map(p => ({ ...p, grabado: marcado(p) })) }))
      await exportarHojaRodaje(cliente, marcar(grupos), mes, año, estado.notas, marcar(gruposCarrusel))
    } catch (e) {
      setError(e.message || 'No se pudo exportar el PDF.')
    } finally {
      setExportando(false)
    }
  }

  const compartir = async () => {
    if (!cliente || compartiendo) return
    setCompartiendo(true); setError(null)
    const { data, error: err } = await compartirHojaRodaje({
      clienteId: cliente.id, organizacionId: cliente.organizacionId, año, mes,
      notas: estado.notas, soloAprobados,
    })
    setCompartiendo(false)
    if (err) { setError(err.message || 'No se pudo crear el enlace.'); return }
    let copiado = false
    try { await navigator.clipboard.writeText(data.url); copiado = true } catch { /* se enseña para copiar a mano */ }
    setEnlace({ url: data.url, copiado })
  }

  const textoBoton = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }

  const contenido = (enModal) => (
    <>
      {/* Cabecera */}
      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
              Hoja de rodaje
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              {cliente.nombre} · <span style={{ textTransform: 'capitalize' }}>{MESES[mes]}</span> {año}
            </p>
          </div>
          <button onClick={exportar} disabled={!total || exportando}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none',
              background: !total ? 'var(--bg-secondary)' : '#D7FF3D', color: !total ? 'var(--text-tertiary)' : '#0B0C10',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: !total || exportando ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}>
            <Download size={14} /> {exportando ? 'Exportando...' : 'Exportar PDF'}
          </button>
          <button onClick={compartir} disabled={compartiendo}
            title="Enlace con la hoja de rodaje vídeo a vídeo, para quien graba"
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11,
              border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: compartiendo ? 'wait' : 'pointer', flexShrink: 0,
            }}>
            <Link2 size={14} /> {compartiendo ? 'Creando...' : 'Compartir enlace'}
          </button>
          {enModal && (
            <button onClick={onClose} title="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
              <X size={18} />
            </button>
          )}
        </div>

        {enlace && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(29,95,224,0.06)', border: '1px solid rgba(29,95,224,0.15)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0', marginBottom: 6 }}>
              {enlace.copiado ? 'Enlace copiado.' : 'Enlace listo.'} Va vídeo a vídeo, sin cuenta. {soloAprobados ? 'Solo enseña los guiones aprobados.' : 'Enseña todos los guiones del mes.'}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={enlace.url} onFocus={e => e.target.select()}
                style={{ flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              <button onClick={() => { navigator.clipboard?.writeText(enlace.url).then(() => setEnlace(e => ({ ...e, copiado: true }))).catch(() => {}) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: 'none', background: '#1D5FE0', color: 'white', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                <Copy size={12} /> Copiar
              </button>
              <a href={enlace.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0', flexShrink: 0 }}>Abrir</a>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
              Si cambias las notas o el filtro, pulsa otra vez "Compartir enlace": se actualiza el mismo enlace.
            </div>
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 16 }}>
          {totalPlanos} {totalPlanos === 1 ? 'plano' : 'planos'} de {totalVideos} {totalVideos === 1 ? 'vídeo' : 'vídeos'}
          {gruposCarrusel.length > 0 && ` · ${totalSlides} ${totalSlides === 1 ? 'slide' : 'slides'} de ${gruposCarrusel.length} ${gruposCarrusel.length === 1 ? 'carrusel' : 'carruseles'}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <motion.div animate={{ width: total ? `${(grabados / total) * 100}%` : '0%' }}
              style={{ height: '100%', background: '#1D5FE0', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{grabados} de {total} hechos</span>
          {grabados > 0 && (
            <button onClick={reiniciar} style={textoBoton}>Reiniciar</button>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <Interruptor activo={soloAprobados} onChange={setSoloAprobadosManual}>Solo guiones aprobados</Interruptor>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={enModal ? { flex: 1, overflowY: 'auto', padding: '18px 24px 28px' } : { padding: '18px 24px 24px' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
            <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#FF3B30', flex: 1 }}>{error}</span>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          Material y notas del día
        </label>
        <textarea
          value={estado.notas}
          onChange={e => guardar({ ...estado, notas: e.target.value })}
          placeholder="Trípode, micro de solapa, luz, cargadores, ropa de cambio..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)',
            fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none',
            fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 22,
          }}
        />

        {!todosGrupos.length ? (
          <div style={{ padding: '28px 20px', borderRadius: 14, background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <Clapperboard size={22} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              {soloAprobados ? 'Ningún guion aprobado tiene planos' : 'Ningún guion de este mes tiene planos'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {soloAprobados ? 'Desactiva el filtro para ver los planos de todos los guiones.' : 'Saca los planos de los guiones para preparar el rodaje.'}
            </p>
          </div>
        ) : (
          <>
            {[
              { id: 'videos', titulo: 'Vídeos', sub: 'Por tipo de plano, para grabar seguidos los que comparten encuadre', icon: Video, color: '#FF2D55', lista: grupos, carrusel: false },
              { id: 'carruseles', titulo: 'Carruseles', sub: 'Las fotos de cada slide, carrusel por carrusel', icon: Images, color: '#1D5FE0', lista: gruposCarrusel, carrusel: true },
            ].filter(b => b.lista.length).map(b => (
              <div key={b.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 14 }}>
                  <b.icon size={16} color={b.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{b.titulo}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.sub}</p>
                  </div>
                </div>
                {b.lista.map(g => {
                  const hechos = g.planos.filter(marcado).length
                  return (
                    <section key={g.clave} style={{ marginBottom: 22 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1, minWidth: 0 }}>{g.tipo}</h4>
                        <span style={{ fontSize: 12, fontWeight: 600, color: hechos === g.planos.length ? '#30D158' : 'var(--text-tertiary)', flexShrink: 0 }}>
                          {hechos} de {g.planos.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {g.planos.map(p => (
                          <FilaPlano key={p.key} plano={p} carrusel={b.carrusel} grabado={marcado(p)} onToggle={() => toggle(p)} />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )

  if (inline) {
    if (!cliente) return null
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}>
        {contenido(false)}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {open && cliente && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            role="dialog" aria-label="Hoja de rodaje"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001, width: 'min(640px, 100vw)',
              background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column',
            }}
          >
            {contenido(true)}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
