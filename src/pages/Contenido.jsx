import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ChevronDown, X, LayoutGrid, List, Sparkles, CalendarDays,
  Clapperboard, CheckCircle2, Undo2, UserRound, AlertCircle,
} from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { completarTareasDelPost } from '../hooks/useTareas'
import { useCalendarioMesTodos, actualizarPost } from '../hooks/useCalendario'
import { etapaContenido, ETAPAS, ETAPA_INFO } from '../utils/etapaContenido'
import TablaPlanos from '../components/TablaPlanos'
import { esCarrusel as esCarruselFormato } from '../utils/formato'

// Contenido: todas las piezas (posts del calendario) de todos los clientes de
// un mes, en un tablero por etapa o en una lista. Es el sitio único para ver
// en qué punto está cada pieza, de la idea a la publicación.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const LS_VISTA = 'aify_contenido_vista'

// Un carrusel con guion sigue siendo carrusel (antes todo lo que tenía guion contaba como vídeo)
const esCarrusel = (p) => esCarruselFormato(p)
const esVideo = (p) => !esCarrusel(p) && (!!p.guion || /video|v[ií]deo|reel|tiktok|short/i.test(p.formato || ''))
const tipoFormato = (p) => esVideo(p) ? 'video' : esCarrusel(p) ? 'carrusel' : 'otros'

const FORMATOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'video', label: 'Vídeo' },
  { id: 'carrusel', label: 'Carrusel' },
  { id: 'otros', label: 'Otros' },
]

function fechaCorta(fecha) {
  if (!fecha) return ''
  const d = new Date(`${fecha}T00:00:00`)
  if (isNaN(d)) return fecha
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

const capitalizar = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
const sinPlanos = (p) => esVideo(p) && !!p.guion && !p.guion.planos?.length

function leerVista() {
  try { return localStorage.getItem(LS_VISTA) === 'lista' ? 'lista' : 'tablero' } catch { return 'tablero' }
}
function guardarVista(v) {
  try { localStorage.setItem(LS_VISTA, v) } catch { /* sin almacenamiento */ }
}

function Boton({ icon: Icon, children, onClick, disabled, primary }) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }} onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 16px', borderRadius: 11,
        border: primary ? 'none' : '1px solid var(--border-color)',
        background: disabled ? 'var(--bg-secondary)' : primary ? '#D7FF3D' : 'var(--bg-card)',
        color: disabled ? 'var(--text-tertiary)' : primary ? '#0B0C10' : 'var(--text-primary)',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {Icon && <Icon size={14} />} {children}
    </motion.button>
  )
}

function Chip({ children, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      color: color || 'var(--text-secondary)', background: color ? `${color}14` : 'var(--bg-secondary)', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function ChipEtapa({ etapa }) {
  const info = ETAPA_INFO[etapa]
  return <Chip color={info.color}>{info.label}</Chip>
}

function ClienteTag({ cliente }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cliente?.color || '#86868B', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente?.nombre || 'Cliente'}</span>
    </span>
  )
}

const selectStyle = {
  padding: '10px 34px 10px 14px', borderRadius: 11, border: '1px solid var(--border-color)',
  fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none', appearance: 'none', width: '100%',
}

function Selector({ value, onChange, children, label }) {
  return (
    <div style={{ position: 'relative', flex: '0 1 200px', minWidth: 140 }}>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {children}
      </select>
      <ChevronDown size={14} color="#86868B" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}

function Tarjeta({ post, cliente, onClick }) {
  return (
    <motion.div layout whileHover={{ y: -1 }} onClick={onClick}
      style={{
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: '11px 12px',
        cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 7,
      }}>
      <ClienteTag cliente={cliente} />
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {post.titulo || 'Pieza sin título'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 2 }}>{fechaCorta(post.fecha)}</span>
        {post.formato && <Chip>{capitalizar(post.formato)}</Chip>}
        {post.red && <Chip>{capitalizar(post.red)}</Chip>}
      </div>
      {sinPlanos(post) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <Clapperboard size={11} /> Sin planos
        </div>
      )}
    </motion.div>
  )
}

function Tablero({ piezas, clientesPorId, onAbrir }) {
  return (
    // El scroll horizontal vive aquí dentro, nunca en el body de la página
    <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 12, minWidth: 'min-content' }}>
        {ETAPAS.map(etapa => {
          const info = ETAPA_INFO[etapa]
          const lista = piezas.filter(p => p.etapa === etapa)
          return (
            <div key={etapa} style={{
              flex: '1 0 230px', width: 230, minWidth: 230, background: 'var(--bg-secondary)', borderRadius: 16,
              padding: 10, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{info.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{lista.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 290px)', minHeight: 80 }}>
                {lista.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '18px 8px', border: '1.5px dashed var(--border-color)', borderRadius: 12 }}>
                    Nada aquí
                  </div>
                ) : lista.map(p => (
                  <Tarjeta key={p.id} post={p} cliente={clientesPorId[String(p.clienteId)]} onClick={() => onAbrir(p.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }
const td = { fontSize: 13, color: 'var(--text-primary)', padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }

function Lista({ piezas, clientesPorId, onAbrir }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
        <thead>
          <tr>
            <th style={th}>Fecha</th>
            <th style={th}>Cliente</th>
            <th style={th}>Título</th>
            <th style={th}>Formato</th>
            <th style={th}>Etapa</th>
            <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {piezas.map(p => (
            <tr key={p.id} onClick={() => onAbrir(p.id)} style={{ cursor: 'pointer' }}>
              <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}>{fechaCorta(p.fecha)}</td>
              <td style={{ ...td, maxWidth: 160 }}><ClienteTag cliente={clientesPorId[String(p.clienteId)]} /></td>
              <td style={{ ...td, fontWeight: 600, maxWidth: 320 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo || 'Pieza sin título'}</div>
                {sinPlanos(p) && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>Sin planos</div>}
              </td>
              <td style={td}>{p.formato ? <Chip>{capitalizar(p.formato)}</Chip> : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}</td>
              <td style={td}><ChipEtapa etapa={p.etapa} /></td>
              <td style={{ ...td, textAlign: 'right' }}>
                <button onClick={(e) => { e.stopPropagation(); onAbrir(p.id) }}
                  style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 9, padding: '5px 11px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Seccion({ titulo, color, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: color || 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</div>
      {children}
    </div>
  )
}

function PanelPieza({ post, cliente, onClose, onCambiado }) {
  const navigate = useNavigate()
  const { setClienteActivoId } = useClienteActivo()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const publicado = post.etapa === 'publicado'

  const cambiarPublicado = async () => {
    setGuardando(true); setError(null)
    try {
      const { error: err } = await actualizarPost(post.clienteId, post.id, { estado: publicado ? 'aprobado' : 'publicado' })
      if (err) throw new Error(err.message || 'No se pudo guardar')
      // Igual que al publicar desde la ficha del cliente: cierra sus tareas, o
      // "Publicar: …" seguiría abierta y saldría como vencida en Inicio
      if (!publicado) await completarTareasDelPost(post.id)
      await onCambiado()
    } catch (e) {
      setError(e.message || 'Algo ha fallado. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const abrirEnGuiones = () => {
    setClienteActivoId(String(post.clienteId))
    navigate('/guiones-del-mes')
  }

  const planos = post.guion?.planos || []

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 199 }} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        style={{ position: 'fixed', top: 0, right: 0, width: 460, maxWidth: '100vw', height: '100vh', background: 'var(--bg-card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
            <ChipEtapa etapa={post.etapa} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Cerrar"
              style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} color="#86868B" />
            </motion.button>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.3 }}>{post.titulo || 'Pieza sin título'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ClienteTag cliente={cliente} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fechaCorta(post.fecha)}{post.hora ? ` · ${post.hora.slice(0, 5)}` : ''}</span>
            {post.red && <Chip>{capitalizar(post.red)}</Chip>}
            {post.formato && <Chip>{capitalizar(post.formato)}</Chip>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {post.aprobacionEstado === 'cambios' && (
            <div style={{ marginBottom: 18, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', marginBottom: 3 }}>EL CLIENTE PIDE</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {post.aprobacionComentario || 'El cliente ha pedido cambios sin dejar comentario.'}
              </div>
            </div>
          )}

          {post.concepto && (
            <Seccion titulo="Concepto">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>{post.concepto}</p>
            </Seccion>
          )}

          {post.guion?.gancho && (
            <Seccion titulo={esCarrusel(post) ? 'Portada' : 'Gancho'} color="#1D5FE0">
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{post.guion.gancho}</div>
            </Seccion>
          )}

          {planos.length > 0 && (
            <Seccion titulo={`${esCarrusel(post) ? 'Slides' : 'Planos'} (${planos.length})`}>
              <TablaPlanos planos={planos} carrusel={esCarrusel(post)} />
            </Seccion>
          )}

          {sinPlanos(post) && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
              Este vídeo tiene guion pero todavía no tiene planos. Sácalos en Guiones del mes.
            </p>
          )}

          {!post.concepto && !post.guion && !post.copy && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Esta pieza todavía es solo una idea en el calendario.
            </p>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'rgba(255,59,48,0.06)', borderRadius: 10, border: '1px solid rgba(255,59,48,0.18)', marginTop: 12 }}>
              <AlertCircle size={14} color="#FF3B30" />
              <span style={{ fontSize: 13, color: '#FF3B30' }}>{error}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {publicado ? (
            <Boton icon={Undo2} onClick={cambiarPublicado} disabled={guardando}>{guardando ? 'Guardando...' : 'Deshacer publicado'}</Boton>
          ) : (
            <Boton icon={CheckCircle2} primary onClick={cambiarPublicado} disabled={guardando}>{guardando ? 'Guardando...' : 'Marcar como publicado'}</Boton>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column' }}>
              <Boton icon={Clapperboard} onClick={abrirEnGuiones}>Abrir en Guiones del mes</Boton>
            </div>
            <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column' }}>
              <Boton icon={UserRound} onClick={() => navigate(`/clientes/${post.clienteId}`)}>Ver ficha del cliente</Boton>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default function Contenido() {
  const navigate = useNavigate()
  const { clientes } = useClientesList()
  const { setClienteActivoId } = useClienteActivo()
  const hoy = new Date()
  const [año, setAño] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [filtroCliente, setFiltroCliente] = useState('todos')
  const [filtroFormato, setFiltroFormato] = useState('todos')
  const [vista, setVistaState] = useState(leerVista)
  const [abiertoId, setAbiertoId] = useState(null)

  const { posts, loading, refetch } = useCalendarioMesTodos(año, mes)

  const clientesPorId = Object.fromEntries(clientes.map(c => [String(c.id), c]))

  const piezas = posts
    .filter(p => filtroCliente === 'todos' || String(p.clienteId) === filtroCliente)
    .filter(p => filtroFormato === 'todos' || tipoFormato(p) === filtroFormato)
    .map(p => ({ ...p, etapa: etapaContenido(p) }))
    .sort((a, b) => ((a.fecha || '') + (a.hora || '')).localeCompare((b.fecha || '') + (b.hora || '')))

  // Derivado de los posts: tras un refetch el panel enseña el dato fresco
  const abierto = abiertoId ? piezas.find(p => String(p.id) === String(abiertoId)) || null : null

  const setVista = (v) => { setVistaState(v); guardarVista(v) }
  const moverMes = (delta) => {
    const d = new Date(año, mes + delta, 1)
    setAño(d.getFullYear()); setMes(d.getMonth()); setAbiertoId(null)
  }
  const elegirCliente = (id) => {
    setFiltroCliente(id)
    if (id !== 'todos') setClienteActivoId(id)
  }

  const hayFiltros = filtroCliente !== 'todos' || filtroFormato !== 'todos'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
      style={{ padding: '36px 40px', flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 4 }}>
          Contenido
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Todas las piezas de tus clientes, de la idea a la publicación
        </p>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '0 4px' }}>
          <button onClick={() => moverMes(-1)} aria-label="Mes anterior" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 130, textAlign: 'center' }}>{capitalizar(MESES[mes])} {año}</span>
          <button onClick={() => moverMes(1)} aria-label="Mes siguiente" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: 'var(--text-secondary)' }}><ChevronRight size={16} /></button>
        </div>

        <Selector label="Cliente" value={filtroCliente} onChange={elegirCliente}>
          <option value="todos">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
        </Selector>

        <Selector label="Formato" value={filtroFormato} onChange={setFiltroFormato}>
          {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.id === 'todos' ? 'Todos los formatos' : f.label}</option>)}
        </Selector>

        <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 11, background: 'var(--bg-secondary)', marginLeft: 'auto' }}>
          {[{ id: 'tablero', label: 'Tablero', icon: LayoutGrid }, { id: 'lista', label: 'Lista', icon: List }].map(v => {
            const activo = vista === v.id
            const Icon = v.icon
            return (
              <button key={v.id} onClick={() => setVista(v.id)} aria-pressed={activo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  background: activo ? 'var(--bg-card)' : 'transparent',
                  color: activo ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activo ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                <Icon size={14} /> {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>
          Cargando piezas del mes...
        </div>
      ) : piezas.length === 0 ? (
        <div style={{ padding: '44px 24px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center', maxWidth: 620 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <LayoutGrid size={22} color="#1D5FE0" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {hayFiltros ? 'Ninguna pieza con estos filtros' : `Todavía no hay contenido en ${MESES[mes]}`}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 auto 18px', maxWidth: 420, lineHeight: 1.5 }}>
            {hayFiltros
              ? 'Prueba con otro cliente u otro formato, o saca ideas nuevas para este mes.'
              : 'Saca ideas para tus clientes o planifica el mes en el calendario. Cada pieza aparecerá aquí y podrás seguirla hasta que se publique.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton icon={Sparkles} primary onClick={() => navigate('/lluvia-de-ideas')}>Lluvia de ideas</Boton>
            <Boton icon={CalendarDays} onClick={() => navigate('/calendario')}>Ir al calendario</Boton>
          </div>
        </div>
      ) : vista === 'lista' ? (
        <Lista piezas={piezas} clientesPorId={clientesPorId} onAbrir={setAbiertoId} />
      ) : (
        <Tablero piezas={piezas} clientesPorId={clientesPorId} onAbrir={setAbiertoId} />
      )}

      <AnimatePresence>
        {abierto && (
          <PanelPieza key={abierto.id} post={abierto} cliente={clientesPorId[String(abierto.clienteId)]}
            onClose={() => setAbiertoId(null)} onCambiado={refetch} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
