import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, CheckSquare, Clock, ArrowRight, X } from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useCalendarioMesTodos } from '../hooks/useCalendario'
import { useTareasList, actualizarTarea } from '../hooks/useTareas'
import { fechaVencimiento } from '../utils/vencimiento'
import { useEsMovil } from '../hooks/useEsMovil'

// ─── Config ───────────────────────────────────────────────────────────────────
// Same palette/labels as Dashboard.jsx (client color) and ClienteDetalle.jsx (red
// social color) — kept as local copies since neither file exports them.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Blue-family palette (no purples) — #8B5CF6 replaced with #3D9BFF this session.
const AVATAR_PALETTE = ['#4F6EF7', '#3D9BFF', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9']
const getAvatarColor = i => AVATAR_PALETTE[i % AVATAR_PALETTE.length]

const RED_COLORS = {
  instagram: '#E1306C', tiktok: '#86868B', facebook: '#1877F2',
  youtube: '#FF0000', whatsapp: '#25D366', googlemaps: '#4285F4', linkedin: '#0A66C2',
}
const RED_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', whatsapp: 'WhatsApp', googlemaps: 'Google Maps', linkedin: 'LinkedIn',
}

// Filtro por red: todas, lo que sale en Instagram o lo que sale en TikTok (un
// post de los dos es red instagram + comparte_en tiktok, ver CalendarioPublicacion).
const FILTROS_RED = [
  { id: 'todas', label: 'Todas' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
]
const CLAVE_RED = 'aify_calendario_general_red'
const sale = (post, red) => post.red === red || (post.comparteEn || []).includes(red)
const pasaFiltroRed = (post, filtro) => filtro === 'todas' || sale(post, filtro)
// Redes en las que sale un post (la suya y con las que se comparte)
const redesDe = (post) => [...new Set([post.red, ...(post.comparteEn || [])].filter(Boolean))]

function leerFiltroRed() {
  try {
    const valor = localStorage.getItem(CLAVE_RED)
    return FILTROS_RED.some(f => f.id === valor) ? valor : 'todas'
  } catch { return 'todas' }
}

// Full-date label for the day-detail panel header, e.g. "Jueves 27 de agosto".
function formatFechaLarga(anio, mes, dia) {
  const diaSemana = new Date(anio, mes, dia).toLocaleDateString('es-ES', { weekday: 'long' })
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} ${dia} de ${MESES[mes].toLowerCase()}`
}

// Postgres devuelve "HH:MM:SS" para una columna `time` — recortamos los
// segundos para mostrarla como el Calendario de iPhone (solo "HH:MM").
const horaCorta = (h) => h ? h.slice(0, 5) : null

function getDiasDelMes(year, month) {
  const primerDia = new Date(year, month, 1).getDay()
  const ajuste = primerDia === 0 ? 6 : primerDia - 1
  const totalDias = new Date(year, month + 1, 0).getDate()
  return { primerDia: ajuste, totalDias }
}

// ─── Task-panel helpers ────────────────────────────────────────────────────────
// Small equivalents of ToDo.jsx's getSeccion/getDateLabel (module-private there,
// not exported) — just enough to sort vencidas → hoy → resto and show a compact
// date label, without pulling in ToDo.jsx's full sectioning/drag-drop machinery.

function hoyISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}
function mananaISO() {
  const m = new Date(); m.setDate(m.getDate() + 1)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}
function seccionOrden(t) {
  const f = fechaVencimiento(t)
  if (!f) return 3
  const h = hoyISO()
  if (f < h) return 0
  if (f === h) return 1
  return 2
}
function getDateLabel(fechaLimite) {
  if (!fechaLimite) return null
  const h = hoyISO(), m = mananaISO()
  if (fechaLimite < h) return { label: 'Vencida', color: '#FF3B30' }
  if (fechaLimite === h) return { label: 'Hoy', color: '#FF9500' }
  if (fechaLimite === m) return { label: 'Mañana', color: '#0071E3' }
  try {
    const [y, mo, d] = fechaLimite.split('-')
    return { label: new Date(y, mo - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), color: 'var(--text-secondary)' }
  } catch { return { label: fechaLimite, color: 'var(--text-secondary)' } }
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function CalendarioGeneral() {
  const navigate = useNavigate()
  const esMovil = useEsMovil()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [filtroRed, setFiltroRed] = useState(leerFiltroRed)
  const cambiarFiltroRed = (id) => {
    setFiltroRed(id)
    try { localStorage.setItem(CLAVE_RED, id) } catch { /* sin almacenamiento */ }
  }

  const { clientes } = useClientesList()
  const { posts: postsMes, loading } = useCalendarioMesTodos(anio, mes)
  const posts = postsMes.filter(p => pasaFiltroRed(p, filtroRed))
  const { tareas: tareasRaw, refetch: refetchTareas } = useTareasList()

  const clienteColor = {}
  const clienteNombre = {}
  clientes.forEach((c, idx) => { clienteColor[c.id] = getAvatarColor(idx); clienteNombre[c.id] = c.nombre })

  const { primerDia, totalDias } = getDiasDelMes(anio, mes)
  const numSemanas = Math.ceil((primerDia + totalDias) / 7)
  const postsPorDia = {}
  posts.forEach(p => {
    if (!postsPorDia[p.dia]) postsPorDia[p.dia] = []
    postsPorDia[p.dia].push(p)
  })
  // Orden tipo agenda: por hora (los que no tienen hora fijada van al final).
  Object.values(postsPorDia).forEach(dia => dia.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99')))

  const hoyDate = new Date()
  const esHoyFn = dia => dia === hoyDate.getDate() && mes === hoyDate.getMonth() && anio === hoyDate.getFullYear()
  const esPasadoFn = dia => new Date(anio, mes, dia) < new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate())

  // A day only makes sense as "selected" within the month it belongs to, so
  // switching months clears whatever day-detail panel was open.
  const prevMonth = () => { setDiaSeleccionado(null); if (mes === 0) { setMes(11); setAnio(y => y - 1) } else setMes(m => m - 1) }
  const nextMonth = () => { setDiaSeleccionado(null); if (mes === 11) { setMes(0); setAnio(y => y + 1) } else setMes(m => m + 1) }

  // Deep-links into the client's own Calendario tab — same `tabInicial` state
  // shape ClienteDetalle.jsx already reads via `location.state?.tabInicial`.
  const irAPost = (post) => navigate(`/clientes/${post.clienteId}`, { state: { tabInicial: 'calendario' } })

  const tareasPendientes = tareasRaw
    .filter(t => !t.completada)
    .map(t => ({ ...t, clienteNombreRes: clienteNombre[t.clienteId] || '' }))
    .sort((a, b) => seccionOrden(a) - seccionOrden(b) || (fechaVencimiento(a) || '').localeCompare(fechaVencimiento(b) || ''))

  // Simple completion only — phase-aware toggling (fases/completarFaseActual) is
  // being built elsewhere; this just flips `completada`, same base case ToDo.jsx covers.
  const toggleTarea = async (id) => {
    await actualizarTarea(id, { completada: true })
    refetchTareas()
  }

  // Tarjeta de un post: la del panel del día en escritorio y la de la agenda del móvil
  const tarjetaPost = (post) => {
    const pid = post.id || `${post.clienteId}_${post.dia}_${post.red}`
    const clienteColorPost = clienteColor[post.clienteId] || '#86868B'
    const redes = redesDe(post)
    return (
      <div
        key={pid}
        onClick={() => irAPost(post)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 8, cursor: 'pointer', background: 'var(--bg-secondary)',
          borderLeft: `3px solid ${clienteColorPost}`,
          ...(esMovil ? { minHeight: 44, boxSizing: 'border-box' } : {}),
        }}
      >
        <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {redes.map(red => (
            <span key={red} style={{ width: 8, height: 8, borderRadius: '50%', background: RED_COLORS[red] || '#86868B' }} title={RED_LABELS[red] || red} />
          ))}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.titulo || RED_LABELS[post.red] || 'Post'}
          </p>
          <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {clienteNombre[post.clienteId] || 'Cliente'}
          </span>
        </div>
        {horaCorta(post.hora) && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>{horaCorta(post.hora)}</span>
        )}
      </div>
    )
  }

  // Agenda del móvil: los días del mes con posts, y hoy aunque esté vacío
  const diasAgenda = Array.from({ length: totalDias }, (_, i) => i + 1)
    .filter(dia => (postsPorDia[dia] || []).length > 0 || esHoyFn(dia))
  const agenda = (
    <div style={{ display: 'flex', flexDirection: 'column', opacity: loading ? 0.5 : 1 }}>
      {diasAgenda.map((dia, i) => {
        const esHoy = esHoyFn(dia)
        const postsDia = postsPorDia[dia] || []
        return (
          <div key={dia} style={{ padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: esPasadoFn(dia) ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
              {diasSemana[(new Date(anio, mes, dia).getDay() + 6) % 7]} {dia}
              {esHoy && <span style={{ fontSize: 10, fontWeight: 700, color: '#0B0C10', background: 'var(--accent-lime)', borderRadius: 10, padding: '2px 8px' }}>Hoy</span>}
            </div>
            {postsDia.length === 0
              ? <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>Sin contenido planificado este día</p>
              : postsDia.map(tarjetaPost)}
          </div>
        )
      })}
    </div>
  )

  const renderCelda = (dia) => {
    const postsDia = postsPorDia[dia] || []
    const esHoy = esHoyFn(dia)
    const esPasado = esPasadoFn(dia)
    const MAX_DOTS = 6
    const seleccionada = diaSeleccionado === dia
    return (
      <div
        key={dia}
        onClick={() => setDiaSeleccionado(dia)}
        style={{
          // Fixed height regardless of how many posts land on this day — a day with
          // content must look the same size as an empty one, only a row of small
          // dots (not full title chips) hints that something is there.
          minHeight: 140, height: 140, padding: '5px 5px 4px', cursor: 'pointer',
          borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
          background: esPasado ? 'var(--bg-secondary)' : 'var(--bg-card)',
          boxShadow: seleccionada ? 'inset 0 0 0 2px #007BFF' : 'none',
          boxSizing: 'border-box', overflow: 'hidden',
        }}
      >
        <div style={{ width: 22, height: 22, borderRadius: '50%', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: esHoy ? 'var(--accent-lime)' : 'transparent' }}>
          <span style={{ fontSize: 11, fontWeight: esHoy ? 700 : 400, color: esHoy ? '#0B0C10' : esPasado ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{dia}</span>
        </div>
        {postsDia.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {postsDia.slice(0, MAX_DOTS).map(post => {
              const pid = post.id || `${post.clienteId}_${post.dia}_${post.red}`
              const color = clienteColor[post.clienteId] || '#86868B'
              return (
                <span
                  key={pid}
                  onClick={(e) => { e.stopPropagation(); irAPost(post) }}
                  title={`${horaCorta(post.hora) ? horaCorta(post.hora) + ' · ' : ''}${post.titulo || RED_LABELS[post.red] || 'Post'} — ${clienteNombre[post.clienteId] || 'Cliente'} · ${redesDe(post).map(r => RED_LABELS[r] || r).join(' y ')}`}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    background: color, opacity: esPasado ? 0.5 : 1,
                  }}
                />
              )
            })}
            {postsDia.length > MAX_DOTS && (
              <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: '8px' }}>
                +{postsDia.length - MAX_DOTS}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <div style={{ width: '100%', boxSizing: 'border-box', padding: esMovil ? '20px 16px 60px' : '40px 40px 80px', display: 'flex', gap: 20, alignItems: esMovil ? 'stretch' : 'flex-start', flexDirection: esMovil ? 'column' : 'row' }}>

        {/* Main column: month calendar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #007BFF 0%, #4DA3FF 45%, #B0E0E6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={18} color="white" strokeWidth={2} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>Calendario general</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Contenido de todos tus clientes en un vistazo</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={prevMonth} aria-label="Mes anterior"
                style={{ width: esMovil ? 44 : 32, height: esMovil ? 44 : 32, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={15} color="var(--text-primary)" />
              </motion.button>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: esMovil ? 120 : 140, textAlign: 'center' }}>{MESES[mes]} {anio}</span>
              <motion.button whileTap={{ scale: 0.9 }} onClick={nextMonth} aria-label="Mes siguiente"
                style={{ width: esMovil ? 44 : 32, height: esMovil ? 44 : 32, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={15} color="var(--text-primary)" />
              </motion.button>
            </div>
          </motion.div>

          {/* Filtro por red */}
          <div role="tablist" aria-label="Filtrar por red" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--bg-secondary)', marginBottom: 14 }}>
            {FILTROS_RED.map(f => {
              const activo = filtroRed === f.id
              return (
                <button key={f.id} type="button" role="tab" aria-selected={activo} onClick={() => cambiarFiltroRed(f.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    background: activo ? 'var(--bg-card)' : 'transparent', color: activo ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activo ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', ...(esMovil ? { minHeight: 44 } : {}),
                  }}>
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Client color legend */}
          {clientes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              {clientes.map((c, idx) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: getAvatarColor(idx), flexShrink: 0 }} />
                  {c.nombre}
                </div>
              ))}
            </div>
          )}

          {!(esMovil && diasAgenda.length === 0) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
            style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {esMovil ? agenda : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
              {diasSemana.map(d => (
                <div key={d} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numSemanas}, 1fr)` }}>
              {Array.from({ length: primerDia }).map((_, i) => (
                <div key={`e-${i}`} style={{ minHeight: 140, height: 140, borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', boxSizing: 'border-box' }} />
              ))}
              {Array.from({ length: totalDias }, (_, i) => i + 1).map(dia => renderCelda(dia))}
            </div>
            </>)}
          </motion.div>}

          {!loading && posts.length === 0 && (
            <p style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
              {filtroRed === 'todas' ? 'No hay contenido planificado este mes.' : `No hay contenido de ${FILTROS_RED.find(f => f.id === filtroRed).label} planificado este mes.`}
            </p>
          )}
        </div>

        {/* Right column: pending tasks, always visible */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
          style={{
            width: esMovil ? '100%' : 320, minWidth: esMovil ? 0 : 320, boxSizing: esMovil ? 'border-box' : undefined, background: 'var(--bg-card)', borderRadius: 16,
            border: '1px solid var(--border-color)', padding: 18,
            ...(esMovil ? { maxHeight: 520 } : { position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)' }),
            display: 'flex', flexDirection: 'column',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckSquare size={16} color="#0071E3" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Tareas pendientes</h2>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {tareasPendientes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>Todo al día</p>
            ) : (
              <AnimatePresence initial={false}>
                {tareasPendientes.map(t => {
                  const dateLabel = getDateLabel(fechaVencimiento(t))
                  return (
                    <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => toggleTarea(t.id)}
                        title="Marcar como completada"
                        style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                          border: '2px solid var(--text-tertiary)', background: 'transparent',
                          cursor: 'pointer', padding: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.titulo}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {t.clienteNombreRes && (
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t.clienteNombreRes}</span>
                          )}
                          {dateLabel && (
                            <span style={{ fontSize: 10, color: dateLabel.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Clock size={9} /> {dateLabel.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>

          <button
            onClick={() => navigate('/todo')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px', borderRadius: 10, border: '1px solid var(--border-color)',
              background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: '#0071E3', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Ver todas <ArrowRight size={12} />
          </button>

          {/* Day-detail panel — opens on cell click (see renderCelda), stays scoped
              to the currently displayed month; cleared on month change. */}
          <AnimatePresence initial={false}>
            {diaSeleccionado != null && (
              <motion.div
                key={`dia-${diaSeleccionado}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 14, paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <Calendar size={14} color="#007BFF" style={{ flexShrink: 0 }} />
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatFechaLarga(anio, mes, diaSeleccionado)}
                      </h3>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setDiaSeleccionado(null)}
                      title="Cerrar"
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: '1px solid var(--border-color)', background: 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={12} color="var(--text-secondary)" />
                    </motion.button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {(postsPorDia[diaSeleccionado] || []).length === 0 ? (
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'center', padding: '14px 4px', margin: 0 }}>
                        Sin contenido planificado este día
                      </p>
                    ) : (
                      postsPorDia[diaSeleccionado].map(tarjetaPost)
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
