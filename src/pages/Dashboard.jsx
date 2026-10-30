import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, CalendarDays, Euro, Pencil, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TarjetaSaludo from '../components/TarjetaSaludo'
import TarjetaVisitas from '../components/TarjetaVisitas'
import Kanban from '../components/Kanban'
import { useClientesList } from '../hooks/useClientes'
import { useFacturasList } from '../hooks/useFacturas'
import { useTareasList } from '../hooks/useTareas'
import { fechaVencimiento, estaVencida } from '../utils/vencimiento'
import { useTablero, moverTarea } from '../hooks/useTableros'
import { useCalendarioMesTodos } from '../hooks/useCalendario'
import { useObjetivo, TIPOS_OBJETIVO } from '../hooks/useObjetivo'
import { dashboardVisitadoKey } from '../utils/tutorial'
import { esHexValido, normalizarHex, colorTextoLegible } from '../utils/colorMarca'
import {
  cobradoEnMes, pendiente, vencido, facturasPendientes, mrr, euros, nombreMes, isoDia,
} from '../utils/metricasDinero'

// Inicio (boceto de Dylan, 2026-09-30):
//   saludo + objetivo del mes + Presupuesto/Crear | visualizaciones por mes | reloj
//   proyectos activos | dinero 2x2                  | cobrado del año
//   tablero de tareas                               | contenido del mes
// Cada bloque lleva a la pantalla donde se resuelve.

const ROJO = '#FF3B30'
const AZUL = '#1D5FE0'
const LIMA = '#D7FF3D'
const TINTA = '#0B0C10'

const CSS = `
.inicio {
  display: grid; gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 320px;
  grid-template-areas:
    "saludo saludo reloj"
    "proyectos dinero grafico"
    "tareas tareas grafico"
    "tareas tareas contenido";
  grid-template-rows: auto auto auto 1fr;
}
.inicio-saludo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; height: 100%; }
.inicio-dinero { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.inicio-fila:hover { background: var(--bg-secondary); }
.inicio-lima:hover { background: #BEE62A; }
.inicio-carpeta:hover .inicio-carpeta-svg { transform: translateY(-2px); }
@media (max-width: 1180px) {
  .inicio {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "saludo saludo" "reloj dinero" "proyectos proyectos" "grafico contenido" "tareas tareas";
    grid-template-rows: none;
  }
}
@media (max-width: 900px) {
  .inicio-saludo { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
  .inicio { grid-template-columns: minmax(0, 1fr); grid-template-areas: "saludo" "reloj" "dinero" "proyectos" "grafico" "contenido" "tareas"; }
}
`

const NUM = { fontVariantNumeric: 'tabular-nums' }
const MESES_INICIAL = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Columna única mientras no esté aplicada la migración 0024 (igual que /todo)
const COLUMNA_SIN_MIGRACION = { id: '__todas', nombre: 'Tareas', color: null, esFinal: false }

// "Listo" = aprobado por el cliente o publicado. post.estado 'aprobado' no
// cuenta: Lluvia de Ideas crea todos los posts con ese estado por defecto.
const estaListo = (p) => p.estado === 'publicado' || p.aprobacionEstado === 'aprobado'

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'

// ── Piezas ──────────────────────────────────────────────────────────────────

function Tarjeta({ area, titulo, accion, children, style }) {
  return (
    <section style={{ gridArea: area, background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: '16px 16px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', ...style }}>
      {(titulo || accion) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>{titulo}</h2>
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

function Enlace({ children, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: AZUL, flexShrink: 0 }}>
      {children} <ChevronRight size={13} />
    </button>
  )
}

function Hueco({ alto = 14, ancho = '80%' }) {
  return <div style={{ height: alto, width: ancho, borderRadius: 6, background: 'var(--bg-secondary)' }} />
}

// ── Objetivo del mes (dentro de la tarjeta de saludo) ────────────────────────

function BarraObjetivo({ objetivo, actual, mes, cargando, onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState(objetivo?.tipo || 'facturacion')
  const [valor, setValor] = useState(objetivo?.valor ? String(objetivo.valor) : '')

  const abrir = () => { setTipo(objetivo?.tipo || 'facturacion'); setValor(objetivo?.valor ? String(objetivo.valor) : ''); setEditando(true) }
  const guardar = () => {
    const n = Number(String(valor).replace(',', '.'))
    if (n > 0) onGuardar({ tipo, valor: n })
    setEditando(false)
  }

  const campo = {
    padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.16)',
    color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none',
  }

  if (cargando) return <div style={{ height: 38 }} />

  if (editando) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...campo, cursor: 'pointer' }}>
          {TIPOS_OBJETIVO.map(t => <option key={t.id} value={t.id} style={{ color: '#0B0C10' }}>{t.label}</option>)}
        </select>
        <input autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false) }}
          placeholder={tipo === 'facturacion' ? '3000 €' : '10 clientes'}
          style={{ ...campo, width: 110 }} />
        <button onClick={guardar} style={{ ...campo, background: 'white', color: '#0B0C10', border: 'none', cursor: 'pointer' }}>Guardar</button>
        {objetivo && (
          <button onClick={() => { onGuardar(null); setEditando(false) }} style={{ ...campo, cursor: 'pointer' }}>Quitar</button>
        )}
        <button onClick={() => setEditando(false)} aria-label="Cancelar" style={{ ...campo, padding: 8, display: 'flex', cursor: 'pointer' }}><X size={14} /></button>
      </div>
    )
  }

  if (!objetivo) {
    return (
      <button onClick={abrir} style={{ ...campo, padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', backdropFilter: 'blur(12px)' }}>
        <Plus size={14} /> Fija tu objetivo de {mes}
      </button>
    )
  }

  const pct = Math.min(100, Math.round((actual / objetivo.valor) * 100))
  const esEuros = objetivo.tipo === 'facturacion'
  return (
    <button onClick={abrir} title="Cambiar el objetivo"
      style={{ width: '100%', maxWidth: 440, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'white', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 7, fontSize: 12.5, fontWeight: 600 }}>
        <span style={{ color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {esEuros ? `Facturación de ${mes}` : 'Clientes activos'} <Pencil size={11} />
        </span>
        <span style={NUM}>
          {esEuros ? `${euros(actual)} / ${euros(objetivo.valor)}` : `${actual} / ${objetivo.valor}`}
          <span style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>{pct} %</span>
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: LIMA, transition: 'width 0.4s ease' }} />
      </div>
    </button>
  )
}

// ── Reloj ────────────────────────────────────────────────────────────────────

function Reloj({ onCalendario }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const dd = (n) => String(n).padStart(2, '0')
  return (
    <Tarjeta area="reloj" style={{ justifyContent: 'center', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ ...NUM, fontSize: 44, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--text-primary)' }}>
          {dd(ahora.getHours())}:{dd(ahora.getMinutes())}<span style={{ color: 'var(--text-tertiary)' }}>:{dd(ahora.getSeconds())}</span>
        </div>
        <button onClick={onCalendario} aria-label="Abrir calendario" title="Calendario"
          style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarDays size={18} color="var(--text-primary)" />
        </button>
      </div>
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
        <span style={{ textTransform: 'capitalize' }}>{DIAS[ahora.getDay()]}</span>, {ahora.getDate()} de {nombreMes(ahora.getMonth())}
      </div>
    </Tarjeta>
  )
}

// ── Proyectos activos: una carpeta por cliente ───────────────────────────────

// `colorTexto`: el de las iniciales; blanco salvo que la carpeta lleve el color de marca
function Carpeta({ color = AZUL, colorTexto = 'white', children }) {
  return (
    <div style={{ position: 'relative', width: 76, height: 60 }}>
      <svg className="inicio-carpeta-svg" width="76" height="60" viewBox="0 0 76 60" aria-hidden="true" style={{ display: 'block', transition: 'transform 0.15s' }}>
        <path d="M4 10a6 6 0 0 1 6-6h17l7 7h32a6 6 0 0 1 6 6v33a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill={color} fillOpacity="0.22" />
        <path d="M4 20a6 6 0 0 1 6-6h56a6 6 0 0 1 6 6v30a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill={color} fillOpacity="0.9" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 22, bottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorTexto, fontSize: 15, fontWeight: 700, letterSpacing: '0.3px', pointerEvents: 'none' }}>
        {children}
      </div>
    </div>
  )
}

function ProyectosActivos({ clientes, cargando, onAbrir, onNuevo }) {
  return (
    <Tarjeta area="proyectos" titulo="Proyectos activos"
      accion={!cargando && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{clientes.length}</span>}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, flex: 1, alignItems: 'flex-start' }}>
        {cargando ? [0, 1, 2].map(i => <div key={i} style={{ width: 76, height: 60, borderRadius: 10, background: 'var(--bg-secondary)', flexShrink: 0 }} />) : (
          <>
            {clientes.map(c => {
              // Color primario del kit de marca si es válido; si no, el de siempre (por sector)
              const primario = esHexValido(c.identidadVisual?.colorPrimario) ? normalizarHex(c.identidadVisual.colorPrimario) : null
              return (
                <button key={c.id} className="inicio-carpeta" onClick={() => onAbrir(c)} title={c.nombre}
                  style={{ flexShrink: 0, width: 80, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Carpeta color={primario || c.color} colorTexto={primario ? colorTextoLegible(primario) : undefined}>{iniciales(c.nombre)}</Carpeta>
                  <span style={{ width: '100%', fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{c.nombre}</span>
                </button>
              )
            })}
            <button onClick={onNuevo} title="Nuevo cliente" aria-label="Nuevo cliente"
              style={{ flexShrink: 0, width: 76, height: 60, borderRadius: 12, border: '1.5px dashed var(--border-color)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} color="var(--text-secondary)" />
            </button>
          </>
        )}
      </div>
    </Tarjeta>
  )
}

// ── Dinero 2x2 ───────────────────────────────────────────────────────────────

// `destacada`: fondo lima (color de acento) con texto en tinta, igual en modo oscuro
function Cifra({ label, valor, sub, subColor, cargando, onClick, destacada }) {
  return (
    <button onClick={onClick} className={destacada ? 'inicio-lima' : 'inicio-fila'}
      style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: destacada ? LIMA : 'var(--bg-card)', border: destacada ? 'none' : '1px solid var(--border-subtle)', borderRadius: 16, padding: destacada ? '13px 15px' : '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: destacada ? 'rgba(11,12,16,0.65)' : 'var(--text-secondary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      {cargando ? <Hueco alto={24} ancho={80} /> : (
        <div style={{ ...NUM, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: destacada ? TINTA : 'var(--text-primary)', lineHeight: 1.1 }}>{valor}</div>
      )}
      <div style={{ ...NUM, fontSize: 11.5, color: subColor || (destacada ? 'rgba(11,12,16,0.55)' : 'var(--text-tertiary)'), marginTop: 5, minHeight: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargando ? '' : sub}</div>
    </button>
  )
}

// ── Cobrado del año (enero a diciembre) ──────────────────────────────────────

function GraficoAnual({ serie, mesActual }) {
  const ref = useRef(null)
  const [ancho, setAncho] = useState(280)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(200, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const ALTO = 150, PX = 8, PT = 14, PB = 22
  const max = Math.max(1, ...serie)
  const x = (i) => PX + (i * (ancho - 2 * PX)) / 11
  const y = (v) => PT + (1 - v / max) * (ALTO - PT - PB)
  const base = ALTO - PB
  const paso = (ancho - 2 * PX) / 11
  // La línea termina en el mes en curso: los meses futuros no son "0 €"
  const puntos = serie.slice(0, mesActual + 1).map((v, i) => [x(i), y(v)])
  const linea = puntos.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = puntos.length ? `${linea} L${puntos[puntos.length - 1][0].toFixed(1)},${base} L${puntos[0][0].toFixed(1)},${base} Z` : ''
  const vacio = serie.every(v => v === 0)
  const verHover = hover != null && hover <= mesActual && !vacio

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
      <svg width={ancho} height={ALTO} role="img" aria-label="Cobrado por mes este año" style={{ display: 'block', overflow: 'visible' }}>
        <line x1={PX} x2={ancho - PX} y1={base} y2={base} stroke="var(--border-color)" strokeWidth={1} />
        {!vacio && <path d={area} fill={AZUL} fillOpacity={0.12} />}
        {!vacio && <path d={linea} fill="none" stroke={AZUL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {verHover && <line x1={x(hover)} x2={x(hover)} y1={PT - 6} y2={base} stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="3 3" />}
        {!vacio && puntos.map(([px, py], i) => (i === hover || i === mesActual) && (
          <circle key={i} cx={px} cy={py} r={4.5} fill={AZUL} stroke="var(--bg-card)" strokeWidth={2} />
        ))}
        {MESES_INICIAL.map((m, i) => (
          <text key={i} x={x(i)} y={ALTO - 6} textAnchor="middle" fontSize={10.5} fontWeight={i === mesActual ? 700 : 500}
            fill={i === mesActual ? 'var(--text-primary)' : 'var(--text-tertiary)'}>{m}</text>
        ))}
        {/* Zonas de hover más anchas que la marca */}
        {MESES_INICIAL.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - paso / 2} y={0} width={paso} height={ALTO} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {vacio && (
        <div style={{ position: 'absolute', inset: `0 0 ${PB}px 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
          Aún no hay facturas cobradas este año
        </div>
      )}
      {verHover && (
        <div style={{
          position: 'absolute', top: -8, left: Math.min(Math.max(x(hover) - 60, 0), ancho - 120), width: 120, pointerEvents: 'none',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '6px 10px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)', fontSize: 12,
        }}>
          <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{nombreMes(hover)}</div>
          <div style={{ ...NUM, fontWeight: 700, color: 'var(--text-primary)' }}>{euros(serie[hover])}</div>
        </div>
      )}
    </div>
  )
}

// ── Contenido del mes por cliente ────────────────────────────────────────────

function FilaContenido({ cliente, listos, total, onClick }) {
  const pct = total ? Math.round((listos / total) * 100) : 0
  return (
    <button className="inicio-fila" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 8px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <span style={{ width: 86, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nombre}</span>
      <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 999, background: cliente.color || AZUL }} />
      </span>
      <span style={{ ...NUM, width: 38, textAlign: 'right', fontSize: 12, fontWeight: 600, color: total ? 'var(--text-secondary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
        {total ? `${listos}/${total}` : '—'}
      </span>
    </button>
  )
}

// ── Tablero de tareas (el mismo de /todo, en pequeño) ────────────────────────

function TarjetaTareaMini({ tarea, arrastrando }) {
  const fecha = fechaVencimiento(tarea)
  const vencida = estaVencida(tarea, isoDia(new Date()))
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, padding: '8px 10px', border: '1px solid var(--border-color)',
      boxShadow: arrastrando ? '0 12px 32px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, lineHeight: 1.35, color: 'var(--text-primary)', overflowWrap: 'anywhere', textDecoration: tarea.completada ? 'line-through' : 'none', opacity: tarea.completada ? 0.6 : 1 }}>
        {tarea.titulo}
      </p>
      {(tarea.clienteNombre || fecha) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, fontSize: 10.5, fontWeight: 500, flexWrap: 'wrap' }}>
          {tarea.clienteNombre && <span style={{ color: AZUL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{tarea.clienteNombre}</span>}
          {fecha && (
            <span style={{ color: vencida ? ROJO : 'var(--text-tertiary)' }}>
              {vencida ? 'Vencida' : new Date(`${fecha}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function TableroInicio({ clientes, onAbrir }) {
  const { tareas: tareasRaw, loading, refetch } = useTareasList()
  const tablero = useTablero('tareas')
  const tareas = tareasRaw.map(t => ({ ...t, clienteNombre: clientes.find(c => String(c.id) === String(t.clienteId))?.nombre || '' }))

  const soloLectura = !tablero.editable
  const columnas = soloLectura ? [COLUMNA_SIN_MIGRACION] : tablero.columnas
  const columnaFinal = columnas.find(c => c.esFinal)
  const columnaDe = (t) => soloLectura ? COLUMNA_SIN_MIGRACION
    : columnas.find(c => String(c.id) === String(t.columnaId)) || (t.completada && columnaFinal) || columnas[0]
  const grupos = Object.fromEntries(columnas.map(c => [c.id, []]))
  tareas.forEach(t => grupos[columnaDe(t).id]?.push(t))
  Object.values(grupos).forEach(arr => arr.sort((a, b) =>
    (a.orden ?? 0) - (b.orden ?? 0) || String(a.creadaEn || '').localeCompare(String(b.creadaEn || ''))))

  return (
    <Tarjeta area="tareas" titulo="Tareas" accion={<Enlace onClick={onAbrir}>Abrir tablero</Enlace>}>
      {tablero.loading || (loading && tareas.length === 0) ? (
        <div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 200, height: 140, borderRadius: 14, background: 'var(--bg-secondary)', flexShrink: 0 }} />)}</div>
      ) : (
        <Kanban
          columnas={columnas}
          grupos={grupos}
          soloLectura={soloLectura}
          anchoColumna={200}
          altoMax={360}
          onMover={async (tarea, columna, ids) => { await moverTarea({ tarea, columna, idsOrdenados: ids, tareas }); await refetch() }}
          renderTarjeta={(t, opts) => <TarjetaTareaMini tarea={t} arrastrando={!!opts?.arrastrando} />}
        />
      )}
    </Tarjeta>
  )
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const ahora = new Date()
  const año = ahora.getFullYear()
  const mes = ahora.getMonth()

  const { clientes, loading: cargandoClientes } = useClientesList()
  const { facturas, loading: cargandoFacturas } = useFacturasList()
  const { posts, loading: cargandoPosts } = useCalendarioMesTodos(año, mes)
  const objetivo = useObjetivo()

  // El tutorial solo arranca si el usuario todavía no ha pasado por el Inicio
  useEffect(() => {
    if (!user?.id) return
    try { localStorage.setItem(dashboardVisitadoKey(user.id), 'true') } catch { /* ignore */ }
  }, [user?.id])

  const activos = clientes.filter(c => !c.archivado)
  const cargandoLista = cargandoClientes && clientes.length === 0

  // ── Dinero ──
  const cobrado = cobradoEnMes(facturas, año, mes)
  const nPendientes = facturasPendientes(facturas, ahora).length
  const totalVencido = vencido(facturas, ahora)
  const serieAño = MESES_INICIAL.map((_, m) => cobradoEnMes(facturas, año, m))
  const totalAño = serieAño.reduce((a, b) => a + b, 0)

  // ── Contenido del mes ──
  const cuentas = Object.fromEntries(activos.map(c => [String(c.id), { listos: 0, total: 0 }]))
  for (const p of posts) {
    const cu = cuentas[String(p.clienteId)]
    if (!cu) continue
    cu.total++
    if (estaListo(p)) cu.listos++
  }
  const cargandoContenido = cargandoLista || (cargandoPosts && posts.length === 0 && activos.length > 0)

  const irADinero = (vista) => navigate(vista ? `/dinero?vista=${vista}` : '/dinero')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
      style={{ padding: '32px 36px', flex: 1, overflowY: 'auto' }}>
      <style>{CSS}</style>
      <div className="inicio" style={{ maxWidth: 1280, margin: '0 auto' }}>

        <div className="inicio-saludo" style={{ gridArea: 'saludo', minWidth: 0 }}>
          <TarjetaSaludo
            user={user}
            sinClientes={!cargandoClientes && clientes.length === 0}
            onNuevoPresupuesto={() => navigate('/dinero?vista=presupuestos&nuevo=presupuesto')}
            onCrear={() => window.dispatchEvent(new CustomEvent('aify:abrir-comandos'))}
            onNuevoCliente={() => navigate('/nuevo-cliente')}
          >
            <BarraObjetivo
              objetivo={objetivo.objetivo}
              actual={objetivo.objetivo?.tipo === 'clientes' ? activos.length : cobrado}
              mes={nombreMes(mes)}
              cargando={objetivo.loading}
              onGuardar={objetivo.guardar}
            />
          </TarjetaSaludo>
          <TarjetaVisitas />
        </div>

        <Reloj onCalendario={() => navigate('/calendario')} />

        <ProyectosActivos
          clientes={activos}
          cargando={cargandoLista}
          onAbrir={(c) => navigate(`/clientes/${c.id}`)}
          onNuevo={() => navigate('/nuevo-cliente')}
        />

        <div className="inicio-dinero" style={{ gridArea: 'dinero' }}>
          <Cifra label={`Cobrado en ${nombreMes(mes)}`} valor={euros(cobrado)} cargando={cargandoFacturas} destacada
            sub="Facturas pagadas" onClick={() => irADinero('facturas')} />
          <Cifra label="Pendiente" valor={euros(pendiente(facturas, ahora))} cargando={cargandoFacturas}
            sub={totalVencido > 0 ? `${euros(totalVencido)} vencido` : `${nPendientes} ${nPendientes === 1 ? 'factura' : 'facturas'}`}
            subColor={totalVencido > 0 ? ROJO : undefined} onClick={() => irADinero('facturas')} />
          <Cifra label="Clientes" valor={activos.length} cargando={cargandoLista}
            sub={clientes.length > activos.length ? `${clientes.length - activos.length} archivados` : 'Activos'}
            onClick={() => navigate('/clientes')} />
          <Cifra label="Recurrente al mes" valor={euros(mrr(clientes))} cargando={cargandoLista}
            sub="Suma de las cuotas" onClick={() => irADinero()} />
        </div>

        <Tarjeta area="grafico" titulo={`Cobrado en ${año}`}>
          {cargandoFacturas && facturas.length === 0 ? <Hueco alto={150} ancho="100%" /> : <GraficoAnual serie={serieAño} mesActual={mes} />}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Total del año</div>
                <div style={{ ...NUM, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{euros(totalAño)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Media mensual</div>
                <div style={{ ...NUM, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{euros(totalAño / (mes + 1))}</div>
              </div>
            </div>
            <button onClick={() => irADinero()} aria-label="Ir a Dinero" title="Dinero"
              style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: LIMA, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Euro size={20} color="#0B0C10" strokeWidth={2.4} />
            </button>
          </div>
        </Tarjeta>

        <TableroInicio clientes={clientes} onAbrir={() => navigate('/todo')} />

        <Tarjeta area="contenido" titulo={`Contenido de ${nombreMes(mes)}`}
          accion={activos.length > 0 && <Enlace onClick={() => navigate('/contenido')}>Ver</Enlace>}>
          {cargandoContenido ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map(i => <Hueco key={i} ancho={`${90 - i * 12}%`} />)}</div>
          ) : activos.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Todavía no tienes clientes activos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', margin: '0 -8px' }}>
              {activos.map(c => (
                <FilaContenido key={c.id} cliente={c} listos={cuentas[String(c.id)].listos} total={cuentas[String(c.id)].total}
                  onClick={() => navigate(`/clientes/${c.id}`)} />
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 8px 0' }}>Vídeos aprobados o publicados del total del mes</div>
            </div>
          )}
        </Tarjeta>
      </div>
    </motion.div>
  )
}
