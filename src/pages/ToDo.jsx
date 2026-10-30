import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, Plus, X, Check, Clock, ChevronDown, ChevronUp, Trash2, Edit3,
  Copy, MoreHorizontal, Archive, RotateCcw, AlertCircle, ArrowUpRight, FileText,
} from 'lucide-react'
import { getPostsCliente } from '../hooks/useCalendario'
import { ORIGEN as ORIGEN_PRODUCCION } from '../components/PlanProduccion'
import { subtituloConPublicacion } from '../utils/planificacion'
import { subtituloConFechas, cambiarPublicacion, moverFechasMarcadas } from '../services/fechasProduccion'
import { fechaVencimiento, estaVencida, avisoEtapa } from '../utils/vencimiento'
import { useProceso } from '../hooks/useProceso'
import { useClientesList } from '../hooks/useClientes'
import {
  useTareasList, crearTarea as crearTareaDB, actualizarTarea as actualizarTareaDB,
  eliminarTarea as eliminarTareaDB, archivarTareas,
} from '../hooks/useTareas'
import { useTablero, moverTarea } from '../hooks/useTableros'
import Kanban, { MenuFlotante, ItemMenu } from '../components/Kanban'
import { REDES_CONTENIDO, redesDelCliente } from '../utils/redes'
import { useEsMovil } from '../hooks/useEsMovil'

// Tareas = tablero Kanban de producción (Por grabar → Por editar → Por
// publicar → Hecho, columnas editables). Nada cambia de columna solo: cada
// tarjeta se mueve a mano. Soltarla en la columna de "hecho" la completa, y
// las completadas se archivan a las 24 h como hasta ahora (0022).

// ─── Constantes ───────────────────────────────────────────────────────────────

const RED_COLORS = {
  instagram: '#E1306C', tiktok: '#86868B', facebook: '#1877F2',
  youtube: '#FF0000', whatsapp: '#25D366', googlemaps: '#4285F4',
}
const RED_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}

const TIPO_COLORS = { desarrollar: '#3D9BFF', preparar: '#FF9500', publicar: '#30D158' }
const TIPO_LABELS = { desarrollar: 'Desarrollar', preparar: 'Preparar', publicar: 'Publicar' }

// Columna de solo lectura mientras no esté aplicada la migración 0024
const COLUMNA_SIN_MIGRACION = { id: '__todas', nombre: 'Tareas', color: null, esFinal: false }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hoyStr() { return fechaStr(new Date()) }
function mananaStr() { const m = new Date(); m.setDate(m.getDate() + 1); return fechaStr(m) }
function finSemanaStr() { const f = new Date(); f.setDate(f.getDate() + 7); return fechaStr(f) }

// Producción vence por la publicación, no por la grabación (utils/vencimiento.js)
const esVencida = (t) => estaVencida(t, hoyStr())

// prefijo: 'Publica' en las tarjetas de producción, para no confundirla con la grabación
function getDateLabel(fechaLimite, completada, prefijo = '') {
  if (!fechaLimite) return null
  const h = hoyStr(), m = mananaStr()
  const p = (txt) => prefijo ? `${prefijo} ${txt.toLowerCase()}` : txt
  if (fechaLimite < h && !completada) return { label: 'Vencida', color: '#FF3B30' }
  if (fechaLimite === h) return { label: p('Hoy'), color: '#FF9500' }
  if (fechaLimite === m) return { label: p('Mañana'), color: '#1D5FE0' }
  try {
    const [y, mo, d] = fechaLimite.split('-')
    return { label: p(new Date(y, mo - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })), color: 'var(--text-secondary)' }
  } catch { return { label: fechaLimite, color: 'var(--text-secondary)' } }
}

// ─── Indicador de progreso de fases (tareas antiguas de Lluvia de Ideas) ─────

function FaseIndicador({ fases }) {
  if (!fases?.length) return null
  const activeIdx = fases.findIndex(f => !f.completada)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      {fases.map((f, i) => {
        const color = TIPO_COLORS[f.tipo] || '#86868B'
        const isActive = i === activeIdx
        const isDone = f.completada
        return (
          <span key={i} style={{
            width: isActive ? 7 : 5, height: isActive ? 7 : 5, borderRadius: '50%',
            background: isDone || isActive ? color : 'transparent',
            border: isDone || isActive ? 'none' : `1.5px solid ${color}55`,
            opacity: isDone || isActive ? 1 : 0.5, flexShrink: 0,
          }} />
        )
      })}
    </div>
  )
}

// ─── Tarjeta de tarea ─────────────────────────────────────────────────────────

function TarjetaTarea({ tarea, etapa = -1, arrastrando, soportaArchivado, pasoLabel, onEditar, onDuplicar, onEliminar, onArchivar, onAbrir }) {
  const [menu, setMenu] = useState(false)
  const esProduccion = tarea.origen === ORIGEN_PRODUCCION
  const dateLabel = getDateLabel(fechaVencimiento(tarea), tarea.completada, esProduccion ? 'Publica' : '')
  const aviso = avisoEtapa(tarea, etapa, hoyStr())
  const subtitulo = esProduccion ? subtituloConPublicacion(tarea.subtitulo, tarea.fechaPublicacion) : tarea.subtitulo
  const faseActivaIdx = tarea.fases?.length ? tarea.fases.findIndex(f => !f.completada) : -1
  const faseActiva = faseActivaIdx >= 0 ? tarea.fases[faseActivaIdx] : null
  const cerrar = () => setMenu(false)

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 11, padding: '10px 12px',
      border: '1px solid var(--border-color)',
      boxShadow: arrastrando ? '0 12px 32px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {tarea.completada && (
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#30D158', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <Check size={10} color="white" strokeWidth={3} />
          </span>
        )}
        <p style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4,
          textDecoration: tarea.completada ? 'line-through' : 'none', opacity: tarea.completada ? 0.6 : 1,
          overflowWrap: 'anywhere',
        }}>
          {tarea.titulo}
        </p>
        {!arrastrando && (
          <div style={{ position: 'relative', flexShrink: 0 }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <button onClick={() => setMenu(v => !v)} aria-label="Opciones de la tarea"
              style={{ width: 24, height: 24, borderRadius: 7, background: menu ? 'var(--bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MoreHorizontal size={13} color="var(--text-secondary)" />
            </button>
            <MenuFlotante abierto={menu} onCerrar={cerrar} ancho={150}>
              <ItemMenu icon={Edit3} label="Editar" onClick={() => { cerrar(); onEditar(tarea) }} />
              <ItemMenu icon={Copy} label="Duplicar" onClick={() => { cerrar(); onDuplicar(tarea) }} />
              {soportaArchivado && <ItemMenu icon={Archive} label="Archivar" onClick={() => { cerrar(); onArchivar(tarea) }} />}
              <ItemMenu icon={Trash2} label="Eliminar" color="#FF3B30" onClick={() => { cerrar(); onEliminar(tarea) }} />
            </MenuFlotante>
          </div>
        )}
      </div>

      {subtitulo && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.35 }}>{subtitulo}</p>
      )}

      {tarea.postId && tarea.ideaTitulo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', minWidth: 0 }}>
          <FileText size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tarea.ideaTitulo}</span>
        </div>
      )}

      {!arrastrando && tarea.clienteId && (tarea.paso || tarea.postId) && (
        <button onClick={() => onAbrir(tarea)} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
          title={tarea.postId ? 'Abrir el guion' : 'Abrir este paso del cliente'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 9px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          {tarea.postId ? 'Abrir guion' : `Abrir ${pasoLabel || 'paso'}`} <ArrowUpRight size={11} />
        </button>
      )}

      {tarea.fases?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <FaseIndicador fases={tarea.fases} />
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Fase {faseActivaIdx === -1 ? tarea.fases.length : faseActivaIdx + 1}/{tarea.fases.length}
            {faseActiva ? ` · ${TIPO_LABELS[faseActiva.tipo] || ''}` : ''}
          </span>
        </div>
      )}

      {(tarea.clienteNombre || tarea.red || dateLabel || aviso) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          {tarea.clienteNombre && (
            <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', fontWeight: 500 }}>
              {tarea.clienteNombre}
            </span>
          )}
          {pasoLabel && (
            <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {pasoLabel}
            </span>
          )}
          {tarea.red && (
            <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: `${RED_COLORS[tarea.red] || '#86868B'}15`, color: RED_COLORS[tarea.red] || '#86868B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED_COLORS[tarea.red] || '#86868B' }} />
              {RED_LABELS[tarea.red] || tarea.red}
            </span>
          )}
          {dateLabel && (
            <span style={{ fontSize: 10.5, color: dateLabel.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {dateLabel.label}
            </span>
          )}
          {aviso && (
            <span title={`Era el ${aviso.fecha}`} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,149,0,0.12)', color: '#FF9500', fontWeight: 600 }}>
              {aviso.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Panel nueva/editar tarea ─────────────────────────────────────────────────

const HOY_PILLS = [
  { label: 'Hoy', getValue: () => hoyStr() },
  { label: 'Mañana', getValue: () => mananaStr() },
  { label: 'Esta semana', getValue: () => finSemanaStr() },
]

// Posts del cliente que se pueden enlazar: los que tienen guion o título, del
// más reciente al más antiguo
const etiquetaPost = (p) => {
  const [a, m] = String(p.fecha || '').split('-')
  const mes = a && m ? new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : ''
  return `${p.titulo || 'Sin título'}${mes ? ` · ${mes}` : ''}`
}

function PanelTarea({ tarea, columna, columnas = [], columnaActualId = null, clientes, pasos, onSave, onClose }) {
  // Tarjetas de "Producción" (PlanProduccion): grabación = fecha_limite,
  // edición = fecha_edicion (0034) y publicación = la fecha del post enlazado
  const esProduccion = tarea?.origen === ORIGEN_PRODUCCION
  const [form, setForm] = useState({
    titulo: tarea?.titulo || '',
    clienteId: tarea?.clienteId || '',
    clienteNombre: tarea?.clienteNombre || '',
    red: tarea?.red || '',
    fechaLimite: tarea?.fechaLimite || '',
    nota: tarea?.nota || '',
    paso: tarea?.paso || '',
    postId: tarea?.postId || '',
    ideaTitulo: tarea?.ideaTitulo || '',
    fechaEdicion: tarea?.fechaEdicion || '',
    columnaId: columnaActualId || '',
  })
  // Publicación: null hasta que cargan los posts del cliente (sale del post)
  const [publicacion, setPublicacion] = useState(null)
  // Guiones/posts del cliente elegido, para enlazar la tarea a uno concreto
  const [posts, setPosts] = useState({ clienteId: null, lista: [] })
  useEffect(() => {
    if (!form.clienteId) return
    let activo = true
    getPostsCliente(form.clienteId, { incluirSinProgramar: true }).then(({ data }) => {
      if (activo) setPosts({ clienteId: form.clienteId, lista: (data || []).filter(p => p.guion || p.titulo) })
    })
    return () => { activo = false }
  }, [form.clienteId])
  const postsCliente = posts.clienteId === form.clienteId ? posts.lista : []
  const postEnlazado = postsCliente.find(p => String(p.id) === String(form.postId)) || null
  // Fecha de publicación actual del post ('' = sin programar)
  const publicacionPost = postEnlazado ? (postEnlazado.enCalendario === false ? '' : postEnlazado.fecha || '') : null
  const fechaPublicacion = publicacion ?? publicacionPost ?? ''

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.titulo.trim()) return
    // La publicación solo se toca si se ha cambiado aquí y hay post enlazado
    const pub = esProduccion && postEnlazado && publicacion !== null && publicacion !== publicacionPost
      ? { post: postEnlazado, fecha: publicacion }
      : null
    onSave({ ...form }, { publicacion: pub, publicacionFinal: esProduccion ? (postEnlazado ? fechaPublicacion : null) : undefined })
  }

  const selectCliente = (id) => {
    const c = clientes.find(c => String(c.id) === String(id))
    // Cambiar de cliente suelta el guion enlazado (era de otro cliente)
    setForm(f => ({ ...f, clienteId: id, clienteNombre: c?.nombre || '', postId: '', ideaTitulo: '', ...(id ? {} : { paso: '' }) }))
    setPublicacion(null)
  }
  const selectPost = (id) => {
    const p = postsCliente.find(x => String(x.id) === String(id))
    // Un guion vive en el paso Guiones: si no había paso, se pone ese
    setForm(f => ({ ...f, postId: id, ideaTitulo: p?.titulo || '', paso: f.paso || (id ? 'guiones' : '') }))
    setPublicacion(null)
  }

  const inputSt = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    color: 'var(--text-primary)', background: 'var(--bg-card)',
  }

  return (
    <motion.div initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      style={{ position: 'fixed', top: 0, right: 0, width: 360, height: '100vh', background: 'var(--bg-card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.1)', zIndex: 200, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {tarea ? 'Editar tarea' : columna ? `Nueva tarea · ${columna.nombre}` : 'Nueva tarea'}
          </p>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="#86868B" />
          </motion.button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            ¿Qué tienes que hacer?
          </label>
          <textarea value={form.titulo} onChange={e => up('titulo', e.target.value)} rows={3}
            placeholder="Publicar el reel de la hamburguesa del mes..."
            style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Cliente</label>
          <select value={form.clienteId} onChange={e => selectCliente(e.target.value)}
            style={{ ...inputSt, cursor: 'pointer' }}>
            <option value="">Sin cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {form.clienteId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Paso del cliente <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
              <select value={form.paso} onChange={e => up('paso', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="">Ninguno</option>
                {pasos.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Guion o post <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
              <select value={form.postId} onChange={e => selectPost(e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="">Ninguno</option>
                {form.postId && !postsCliente.some(p => String(p.id) === String(form.postId)) && (
                  <option value={form.postId}>{form.ideaTitulo || 'Guion enlazado'}</option>
                )}
                {postsCliente.map(p => <option key={p.id} value={p.id}>{etiquetaPost(p)}</option>)}
              </select>
              {form.postId && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '5px 0 0', lineHeight: 1.4 }}>
                  Se completa sola cuando ese post se marca como publicado.
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Red social <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
          <select value={form.red} onChange={e => up('red', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
            <option value="">Ninguna</option>
            {/* Solo las redes del cliente elegido (y la que ya tuviera la tarea) */}
            {[...new Set([...redesDelCliente(clientes.find(c => String(c.id) === String(form.clienteId))), ...(form.red ? [form.red] : [])])]
              .map(id => <option key={id} value={id}>{REDES_CONTENIDO[id] || RED_LABELS[id] || id}</option>)}
          </select>
        </div>

        {esProduccion ? (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>Producción</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Día de grabación', value: form.fechaLimite, onChange: v => up('fechaLimite', v) },
                { label: 'Día de edición', value: form.fechaEdicion, onChange: v => up('fechaEdicion', v) },
              ].map(c => (
                <label key={c.label} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {c.label}
                  <input type="date" value={c.value} onChange={e => c.onChange(e.target.value)} style={{ ...inputSt }}
                    onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                </label>
              ))}
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                Día de publicación
                <input type="date" value={fechaPublicacion} disabled={!postEnlazado}
                  onChange={e => setPublicacion(e.target.value)} style={{ ...inputSt, opacity: postEnlazado ? 1 : 0.6 }}
                  onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                  {!form.postId ? 'Enlaza un guion para poner la fecha de publicación.'
                    : !postEnlazado ? 'Cargando el guion...'
                    : fechaPublicacion ? 'Cambia también la fecha del post en el calendario del cliente. Déjala vacía para sacarlo del calendario.'
                    : 'Sin fecha: el guion sigue fuera del calendario. Pon una fecha para añadirlo.'}
                </span>
              </label>
              {form.fechaLimite && form.fechaEdicion && form.fechaEdicion < form.fechaLimite && (
                <p style={{ fontSize: 12, color: '#FF9500', margin: 0 }}>La edición cae antes que la grabación.</p>
              )}
              {form.fechaEdicion && fechaPublicacion && fechaPublicacion < form.fechaEdicion && (
                <p style={{ fontSize: 12, color: '#FF9500', margin: 0 }}>La publicación cae antes que la edición.</p>
              )}
            </div>
          </div>
        ) : (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>¿Para cuándo?</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {HOY_PILLS.map(p => (
              <button key={p.label} onClick={() => up('fechaLimite', p.getValue())}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${form.fechaLimite === p.getValue() ? '#1D5FE0' : 'var(--border-color)'}`, background: form.fechaLimite === p.getValue() ? '#1D5FE0' : 'var(--bg-card)', color: form.fechaLimite === p.getValue() ? 'white' : 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="date" value={form.fechaLimite} onChange={e => up('fechaLimite', e.target.value)} style={{ ...inputSt }}
            onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
        </div>
        )}

        {tarea && columnas.length > 1 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Columna</label>
            <select value={form.columnaId} onChange={e => up('columnaId', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
              {columnas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Notas <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
          <textarea value={form.nota} onChange={e => up('nota', e.target.value)} rows={2}
            placeholder="Detalles adicionales..."
            style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
        </div>
      </div>

      <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border-color)' }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
          disabled={!form.titulo.trim()}
          style={{ width: '100%', padding: '12px', borderRadius: 12, background: form.titulo.trim() ? '#D7FF3D' : '#86868B', color: form.titulo.trim() ? '#0B0C10' : 'white', border: 'none', cursor: form.titulo.trim() ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
          {tarea ? 'Guardar cambios' : 'Guardar tarea'}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ToDo() {
  const esMovil = useEsMovil()
  const navigate = useNavigate()
  const proceso = useProceso()
  const pasoLabel = (id) => (id ? proceso.editable.find(p => p.id === id)?.label || null : null)
  const { tareas: tareasRaw, archivadas, soportaArchivado, refetch: refetchTareas } = useTareasList()
  const tablero = useTablero('tareas')
  const { clientes } = useClientesList()
  const [confirmarArchivar, setConfirmarArchivar] = useState(false)
  const [archivadasAbiertas, setArchivadasAbiertas] = useState(false)
  const [filtroCliente, setFiltroCliente] = useState('todos')
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [columnaNueva, setColumnaNueva] = useState(null)

  // clienteNombre no es columna de tareas (sale de la FK a clientes)
  const tareas = tareasRaw.map(t => ({
    ...t,
    clienteNombre: clientes.find(c => String(c.id) === String(t.clienteId))?.nombre || '',
  }))

  const tareasFiltradas = tareas.filter(t => filtroCliente === 'todos' || String(t.clienteId) === String(filtroCliente))

  // Sin la migración 0024 (o si fallan las columnas) se ven todas las tareas
  // en una sola columna, sin arrastrar; editar/duplicar/archivar siguen igual.
  const soloLectura = !tablero.editable
  const columnas = soloLectura ? [COLUMNA_SIN_MIGRACION] : tablero.columnas
  const columnaFinal = columnas.find(c => c.esFinal)

  // Tarea sin columna (antigua o creada desde otra pantalla) → primera
  // columna; si ya estaba completada, a la de "hecho".
  const columnaDe = (t) => {
    if (soloLectura) return COLUMNA_SIN_MIGRACION
    return columnas.find(c => String(c.id) === String(t.columnaId))
      || (t.completada && columnaFinal) || columnas[0]
  }
  const grupos = Object.fromEntries(columnas.map(c => [c.id, []]))
  tareasFiltradas.forEach(t => grupos[columnaDe(t).id]?.push(t))
  Object.values(grupos).forEach(arr => arr.sort((a, b) =>
    (a.orden ?? 0) - (b.orden ?? 0) || String(a.creadaEn || '').localeCompare(String(b.creadaEn || ''))))

  const cerrarPanel = () => { setPanelAbierto(false); setEditando(null); setColumnaNueva(null) }
  const abrirNueva = (columna) => {
    setEditando(null)
    setColumnaNueva(soloLectura ? null : (columna || columnas[0]))
    setPanelAbierto(true)
  }

  const agregarTarea = async (form) => {
    const col = columnaNueva
    await crearTareaDB({
      titulo: form.titulo,
      clienteId: form.clienteId,
      red: form.red,
      fechaLimite: form.fechaLimite,
      nota: form.nota,
      paso: form.paso,
      postId: form.postId,
      ideaTitulo: form.ideaTitulo,
      origen: 'manual',
      columnaId: col?.id,
      orden: col ? (grupos[col.id] || []).length : tareas.length,
    })
    await refetchTareas()
    cerrarPanel()
  }

  const editarTarea = async (form, extra = {}) => {
    const t = editando
    const datos = { ...form }
    delete datos.clienteNombre // sale de la FK, no es columna
    delete datos.columnaId // el cambio de columna va por moverTarea (completa/publica igual que arrastrar)
    // Sin la migración 0033 no se puede mandar paso: solo si hay o había uno
    if (!datos.paso && !t.paso) delete datos.paso
    // Igual con fecha_edicion (0034)
    if (!datos.fechaEdicion && !t.fechaEdicion) delete datos.fechaEdicion

    if (t.origen === ORIGEN_PRODUCCION) {
      // Publicación: sin post cargado se conserva lo que ya ponía la tarjeta
      const publicacion = extra.publicacionFinal !== undefined ? extra.publicacionFinal : undefined
      datos.subtitulo = subtituloConFechas(t, { grabacion: form.fechaLimite, edicion: form.fechaEdicion, publicacion })
    }
    await actualizarTareaDB(t.id, datos)

    // Fecha de publicación del post enlazado
    if (extra.publicacion) {
      const { post, fecha } = extra.publicacion
      await cambiarPublicacion(form.clienteId, post, fecha, form.fechaLimite)
    }

    // Fechas marcadas del cliente (grabación y edición)
    if (t.origen === ORIGEN_PRODUCCION && form.clienteId) {
      const cliente = clientes.find(c => String(c.id) === String(form.clienteId))
      const otras = [...tareasRaw, ...archivadas].filter(x => x.id !== t.id && x.origen === ORIGEN_PRODUCCION && String(x.clienteId) === String(form.clienteId))
      await moverFechasMarcadas({ cliente, tarea: t, grabacion: form.fechaLimite, edicion: form.fechaEdicion, otras, notas: form.titulo })
    }

    // Cambio de columna desde el panel: al final de la columna nueva
    const actual = columnaDe(t)
    if (form.columnaId && String(form.columnaId) !== String(actual.id)) {
      const destino = columnas.find(c => String(c.id) === String(form.columnaId))
      if (destino) {
        const ids = [...(grupos[destino.id] || []).map(x => x.id), t.id]
        await moverTarea({ tarea: { ...t, ...datos }, columna: destino, idsOrdenados: ids, tareas: tareasFiltradas })
      }
    }
    await refetchTareas()
    cerrarPanel()
  }

  // Lleva a la ficha del cliente, en el paso de la tarea; con guion enlazado,
  // a Guiones del mes de ese mes con el guion abierto
  const abrirTarea = async (t) => {
    if (!t.clienteId) return
    if (t.postId) {
      const { data } = await getPostsCliente(t.clienteId, { incluirSinProgramar: true })
      const post = (data || []).find(p => String(p.id) === String(t.postId))
      const mes = String(post?.fecha || '').slice(0, 7)
      const qs = new URLSearchParams({ ...(mes ? { mes } : {}), guion: String(t.postId) })
      navigate(`/clientes/${t.clienteId}?${qs}`, { state: { tabInicial: 'guiones' } })
      return
    }
    navigate(`/clientes/${t.clienteId}`, { state: { tabInicial: t.paso } })
  }

  const eliminarTarea = async (tarea) => {
    await eliminarTareaDB(tarea.id)
    refetchTareas()
  }

  const duplicarTarea = async (tarea) => {
    const copia = { ...tarea, id: undefined, titulo: `${tarea.titulo} (copia)`, orden: (tarea.orden ?? 0) + 1 }
    delete copia.clienteNombre
    await crearTareaDB(copia)
    refetchTareas()
  }

  const archivarTarea = async (tarea) => {
    await archivarTareas([tarea.id])
    refetchTareas()
  }

  const moverTarjeta = async (tarea, columna, idsOrdenados) => {
    await moverTarea({ tarea, columna, idsOrdenados, tareas: tareasFiltradas })
    await refetchTareas()
  }

  const totalPendientes = tareas.filter(t => !t.completada).length

  // Vencidas visibles con el filtro actual: el botón archiva justo esas
  const vencidasVisibles = tareasFiltradas.filter(esVencida)
  const archivarVencidas = async () => {
    if (!confirmarArchivar) { setConfirmarArchivar(true); return }
    setConfirmarArchivar(false)
    await archivarTareas(vencidasVisibles.map(t => t.id))
    refetchTareas()
  }
  const restaurar = async (id) => {
    await archivarTareas([id], false)
    refetchTareas()
  }

  return (
    <div style={{ flex: 1, background: 'var(--gradient-bg)', minHeight: '100vh', minWidth: 0 }}>
      <AnimatePresence>
        {(panelAbierto || editando) && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={cerrarPanel}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 199 }} />
            <PanelTarea
              tarea={editando}
              columna={columnaNueva}
              columnas={soloLectura ? [] : columnas}
              columnaActualId={editando ? columnaDe(editando).id : null}
              clientes={clientes}
              pasos={proceso.pasos}
              onSave={editando ? editarTarea : agregarTarea}
              onClose={cerrarPanel}
            />
          </>
        )}
      </AnimatePresence>

      <div className={esMovil ? 'pagina-movil' : undefined} style={{ padding: esMovil ? '20px 16px 60px' : '40px 40px 80px' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #30D158, #1D5FE0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckSquare size={18} color="white" strokeWidth={2} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', margin: 0 }}>Tareas</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              {totalPendientes > 0
                ? `${totalPendientes} tarea${totalPendientes !== 1 ? 's' : ''} pendiente${totalPendientes !== 1 ? 's' : ''}. Arrastra cada tarjeta a su columna.`
                : 'Tu tablero de producción. Arrastra cada tarjeta a su columna.'}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => abrirNueva(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 12, background: '#D7FF3D', color: '#0B0C10', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            <Plus size={14} /> Nueva tarea
          </motion.button>
        </motion.div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            style={{ minWidth: esMovil ? 0 : 200, ...(esMovil ? { flex: '1 1 100%' } : {}), padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <option value="todos">Todos los clientes</option>
            {clientes.filter(c => !c.archivado).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {soportaArchivado && vencidasVisibles.length > 0 && (
            <button onClick={archivarVencidas} onMouseLeave={() => setConfirmarArchivar(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: confirmarArchivar ? '#FF3B30' : 'rgba(255,59,48,0.1)', color: confirmarArchivar ? 'white' : '#FF3B30', transition: 'all 0.15s' }}>
              <Archive size={13} />
              {confirmarArchivar
                ? `¿Archivar ${vencidasVisibles.length}? Pulsa otra vez`
                : `Archivar ${vencidasVisibles.length === 1 ? 'la vencida' : `las ${vencidasVisibles.length} vencidas`}`}
            </button>
          )}
        </div>

        {(tablero.sinMigracion || tablero.error) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,149,0,0.1)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }}>
            <AlertCircle size={16} color="#FF9500" />
            {tablero.sinMigracion
              ? 'Actualiza la base de datos para usar los tableros. Mientras tanto, tus tareas se ven aquí sin columnas.'
              : 'No se pudieron cargar las columnas del tablero. Vuelve a intentarlo en un momento.'}
          </div>
        )}

        {/* Tablero */}
        {tablero.loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando tablero...</p>
        ) : (
          <Kanban
            columnas={columnas}
            grupos={grupos}
            soloLectura={soloLectura}
            textoNueva="Nueva tarea"
            onNueva={abrirNueva}
            onMover={moverTarjeta}
            onRenombrarColumna={tablero.renombrarColumna}
            onColorColumna={tablero.cambiarColorColumna}
            onMoverColumna={tablero.moverColumna}
            onEliminarColumna={async (id) => { await tablero.eliminarColumna(id); await refetchTareas() }}
            onCrearColumna={tablero.crearColumna}
            renderTarjeta={(t, opts) => (
              <TarjetaTarea
                tarea={t}
                etapa={soloLectura ? -1 : columnas.findIndex(c => String(c.id) === String(columnaDe(t).id))}
                arrastrando={!!opts?.arrastrando}
                soportaArchivado={soportaArchivado}
                onEditar={(x) => { setEditando(x); setPanelAbierto(true) }}
                onDuplicar={duplicarTarea}
                onEliminar={eliminarTarea}
                onArchivar={archivarTarea}
                pasoLabel={pasoLabel(t.paso)}
                onAbrir={abrirTarea}
              />
            )}
          />
        )}

        {/* Archivadas: completadas de hace más de 24 h y archivadas a mano */}
        {soportaArchivado && archivadas.length > 0 && (
          <div style={{ marginTop: 22, maxWidth: 720, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <button onClick={() => setArchivadasAbiertas(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <Archive size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Archivadas</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 8px', borderRadius: 10 }}>{archivadas.length}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>Se borran a los 7 días</span>
              <span style={{ marginLeft: 'auto', display: 'flex' }}>{archivadasAbiertas ? <ChevronUp size={15} color="var(--text-secondary)" /> : <ChevronDown size={15} color="var(--text-secondary)" />}</span>
            </button>
            {archivadasAbiertas && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {archivadas.map(t => {
                  const cliente = clientes.find(c => String(c.id) === String(t.clienteId))?.nombre
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: t.completada ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {[cliente, `Archivada el ${new Date(t.archivadaEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button onClick={() => restaurar(t.id)} title="Restaurar"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        <RotateCcw size={12} /> Restaurar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
