import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, Edit3, Trash2, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { COLORES_COLUMNA, marcarArrastre } from '../hooks/useTableros'
import { useEsMovil } from '../hooks/useEsMovil'

// Tablero Kanban genérico (tareas y clientes). Las tarjetas solo cambian de
// columna cuando alguien las arrastra: el componente no decide nada por su
// cuenta. Mientras se arrastra, el orden vive en `borrador`; al soltar se
// llama a onMover y, cuando el padre ha vuelto a leer los datos, se descarta.

const ANCHO_COLUMNA = 280

export function MenuFlotante({ abierto, onCerrar, children, ancho = 180 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onCerrar() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [abierto, onCerrar])
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.12 }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', right: 0, top: 30, zIndex: 60, minWidth: ancho, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ItemMenu({ icon: Icon, label, onClick, color }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '100%', padding: '9px 14px', background: hover ? 'var(--bg-secondary)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: color || 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left' }}>
      {Icon && <Icon size={13} color={color || 'var(--text-secondary)'} />}
      {label}
    </button>
  )
}

// ── Tarjeta arrastrable ───────────────────────────────────────────────────────

function Tarjeta({ id, deshabilitado, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: deshabilitado })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.35 : 1,
        cursor: deshabilitado ? 'default' : 'grab',
        touchAction: deshabilitado ? 'auto' : 'none',
        outline: 'none',
      }}>
      {children}
    </div>
  )
}

// ── Cabecera de columna ───────────────────────────────────────────────────────

function CabeceraColumna({ columna, total, esPrimera, esUltima, soloLectura, puedeEliminar, onRenombrar, onColor, onMover, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(columna.nombre)
  const [menu, setMenu] = useState(false)
  const [verColores, setVerColores] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const cerrarMenu = () => { setMenu(false); setVerColores(false); setConfirmarBorrar(false) }

  const empezarEdicion = () => { if (soloLectura) return; setBorrador(columna.nombre); setEditando(true); cerrarMenu() }
  const guardar = () => {
    setEditando(false)
    if (borrador.trim() && borrador.trim() !== columna.nombre) onRenombrar(columna.id, borrador)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '0 2px', minHeight: 28, position: 'relative' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: columna.color || 'var(--text-tertiary)', flexShrink: 0 }} />
      {editando ? (
        <input autoFocus value={borrador} onChange={e => setBorrador(e.target.value)}
          onBlur={guardar}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false) }}
          style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, padding: '3px 6px', borderRadius: 6, border: '1.5px solid #1D5FE0', outline: 'none', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
      ) : (
        <span onClick={empezarEdicion} title={soloLectura ? undefined : 'Pulsa para renombrar'}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: soloLectura ? 'default' : 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {columna.nombre}
        </span>
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>{total}</span>
      {columna.esFinal && !editando && (
        <span title="Las tarjetas que sueltes aquí se marcan como hechas" style={{ display: 'flex', flexShrink: 0 }}><Check size={13} color="#30D158" /></span>
      )}
      {!soloLectura && (
        <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}>
          <button onClick={() => (menu ? cerrarMenu() : setMenu(true))} aria-label="Opciones de columna"
            style={{ width: 26, height: 26, borderRadius: 7, background: menu ? 'var(--bg-secondary)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoreHorizontal size={14} color="var(--text-secondary)" />
          </button>
          <MenuFlotante abierto={menu} onCerrar={cerrarMenu} ancho={200}>
            <ItemMenu icon={Edit3} label="Renombrar" onClick={empezarEdicion} />
            <ItemMenu label={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 13, height: 13, borderRadius: '50%', background: columna.color || 'var(--text-tertiary)' }} />Color</span>} onClick={() => setVerColores(v => !v)} />
            {verColores && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 14px 10px' }}>
                {COLORES_COLUMNA.map(c => (
                  <button key={c} onClick={() => { onColor(columna.id, c); cerrarMenu() }} aria-label={`Color ${c}`}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: columna.color === c ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            )}
            {!esPrimera && <ItemMenu icon={ChevronLeft} label="Mover a la izquierda" onClick={() => { onMover(columna.id, -1); cerrarMenu() }} />}
            {!esUltima && <ItemMenu icon={ChevronRight} label="Mover a la derecha" onClick={() => { onMover(columna.id, 1); cerrarMenu() }} />}
            {puedeEliminar && (
              <ItemMenu icon={Trash2} color="#FF3B30"
                label={confirmarBorrar ? 'Pulsa otra vez para eliminar' : 'Eliminar columna'}
                onClick={() => { if (!confirmarBorrar) { setConfirmarBorrar(true); return } onEliminar(columna.id); cerrarMenu() }} />
            )}
            {puedeEliminar && confirmarBorrar && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, padding: '0 14px 10px', lineHeight: 1.4 }}>
                Sus tarjetas pasan a la primera columna.
              </p>
            )}
          </MenuFlotante>
        </div>
      )}
    </div>
  )
}

// ── Columna ───────────────────────────────────────────────────────────────────

function Columna({ columna, ids, porId, renderTarjeta, soloLectura, textoNueva, onNueva, cabecera, ancho, altoMax }) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.id, disabled: soloLectura })
  return (
    <div style={{ width: ancho, flexShrink: 0, scrollSnapAlign: 'start', background: isOver ? 'rgba(29,95,224,0.06)' : 'var(--bg-secondary)', borderRadius: 14, padding: 10, transition: 'background 0.15s', display: 'flex', flexDirection: 'column', maxHeight: altoMax }}>
      {cabecera}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 48, overflowY: 'auto', paddingBottom: 2 }}>
          {ids.map(id => porId.has(String(id)) && (
            <Tarjeta key={id} id={id} deshabilitado={soloLectura}>
              {renderTarjeta(porId.get(String(id)))}
            </Tarjeta>
          ))}
        </div>
      </SortableContext>
      {onNueva && (
        <button onClick={() => onNueva(columna)}
          style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <Plus size={13} /> {textoNueva}
        </button>
      )}
    </div>
  )
}

// ── Añadir columna ────────────────────────────────────────────────────────────

function AnadirColumna({ onCrear }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const crear = async () => {
    if (!nombre.trim()) { setAbierto(false); return }
    await onCrear(nombre)
    setNombre('')
    setAbierto(false)
  }
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        style={{ width: ANCHO_COLUMNA, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', borderRadius: 14, border: '1.5px dashed var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
        <Plus size={14} /> Añadir columna
      </button>
    )
  }
  return (
    <div style={{ width: ANCHO_COLUMNA, flexShrink: 0, padding: 10, borderRadius: 14, background: 'var(--bg-secondary)' }}>
      <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la columna"
        onKeyDown={e => { if (e.key === 'Enter') crear(); if (e.key === 'Escape') { setNombre(''); setAbierto(false) } }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #1D5FE0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={crear}
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Añadir
        </button>
        <button onClick={() => { setNombre(''); setAbierto(false) }} aria-label="Cancelar"
          style={{ width: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} color="var(--text-secondary)" />
        </button>
      </div>
    </div>
  )
}

// ── Tablero ───────────────────────────────────────────────────────────────────

/**
 * columnas: [{ id, nombre, color, esFinal }]
 * grupos:   { [columnaId]: items[] } ya ordenados; cada item tiene `id`
 * onMover(item, columna, idsOrdenados) → promesa que resuelve cuando el padre ya releyó
 */
export default function Kanban({
  columnas, grupos, renderTarjeta, onMover, soloLectura = false,
  textoNueva = 'Nueva tarjeta', onNueva,
  // El Inicio lo usa en pequeño: columnas estrechas y altura fija
  anchoColumna = ANCHO_COLUMNA, altoMax = 'calc(100vh - 240px)',
  onRenombrarColumna, onColorColumna, onMoverColumna, onEliminarColumna, onCrearColumna,
}) {
  const [borrador, setBorrador] = useState(null) // { [colId]: ids[] } durante el arrastre
  // En móvil, el tablero de tamaño normal (no el pequeño del Inicio) muestra
  // una columna de ~85 % del ancho cada vez y se desliza encajando en cada una.
  const deslizable = useEsMovil() && anchoColumna === ANCHO_COLUMNA
  const [activoId, setActivoId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const base = Object.fromEntries(columnas.map(c => [c.id, (grupos[c.id] || []).map(i => i.id)]))
  const contenedores = borrador || base
  const porId = new Map()
  columnas.forEach(c => (grupos[c.id] || []).forEach(i => porId.set(String(i.id), i)))

  const buscarColumna = (id, conts = contenedores) => {
    if (id == null) return null
    if (Object.prototype.hasOwnProperty.call(conts, id)) return id
    return Object.keys(conts).find(k => conts[k].some(x => String(x) === String(id))) || null
  }

  const onDragStart = ({ active }) => {
    setActivoId(active.id)
    setBorrador(base)
  }

  const onDragOver = ({ active, over }) => {
    if (!over) return
    setBorrador(prev => {
      const conts = prev || base
      const desde = buscarColumna(active.id, conts)
      const hasta = buscarColumna(over.id, conts)
      if (!desde || !hasta || desde === hasta) return prev
      const origen = conts[desde].filter(x => String(x) !== String(active.id))
      const destino = [...conts[hasta]]
      const idxOver = destino.findIndex(x => String(x) === String(over.id))
      destino.splice(idxOver === -1 ? destino.length : idxOver, 0, active.id)
      return { ...conts, [desde]: origen, [hasta]: destino }
    })
  }

  const terminar = () => { marcarArrastre(); setActivoId(null); setBorrador(null) }

  const onDragEnd = async ({ active, over }) => {
    marcarArrastre()
    setActivoId(null)
    if (!over || !borrador) { setBorrador(null); return }
    const hasta = buscarColumna(over.id, borrador)
    if (!hasta) { setBorrador(null); return }
    let ids = borrador[hasta]
    const iActivo = ids.findIndex(x => String(x) === String(active.id))
    const iOver = ids.findIndex(x => String(x) === String(over.id))
    if (iActivo !== -1 && iOver !== -1 && iActivo !== iOver) ids = arrayMove(ids, iActivo, iOver)
    const final = { ...borrador, [hasta]: ids }
    const desdeOriginal = buscarColumna(active.id, base)
    const sinCambios = desdeOriginal === hasta && base[hasta].every((x, i) => String(x) === String(ids[i]))
    if (sinCambios) { setBorrador(null); return }
    setBorrador(final)
    try {
      await onMover(porId.get(String(active.id)), columnas.find(c => String(c.id) === String(hasta)), ids)
    } finally {
      setBorrador(null)
    }
  }

  const activo = activoId != null ? porId.get(String(activoId)) : null
  const puedeEliminar = columnas.length > 1

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={terminar}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 12, ...(deslizable ? { scrollSnapType: 'x mandatory' } : {}) }}>
        {columnas.map((col, i) => (
          <Columna key={col.id}
            columna={col}
            ids={contenedores[col.id] || []}
            porId={porId}
            renderTarjeta={renderTarjeta}
            soloLectura={soloLectura}
            ancho={deslizable ? '85%' : anchoColumna}
            altoMax={altoMax}
            textoNueva={textoNueva}
            onNueva={!soloLectura && onNueva && !col.esFinal ? onNueva : null}
            cabecera={
              <CabeceraColumna
                columna={col}
                total={(contenedores[col.id] || []).length}
                esPrimera={i === 0}
                esUltima={i === columnas.length - 1}
                soloLectura={soloLectura || !onRenombrarColumna}
                puedeEliminar={puedeEliminar}
                onRenombrar={onRenombrarColumna}
                onColor={onColorColumna}
                onMover={onMoverColumna}
                onEliminar={onEliminarColumna}
              />
            }
          />
        ))}
        {!soloLectura && onCrearColumna && <AnadirColumna onCrear={onCrearColumna} />}
      </div>
      <DragOverlay>
        {activo ? <div style={{ cursor: 'grabbing', transform: 'rotate(1.5deg)' }}>{renderTarjeta(activo, { arrastrando: true })}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}
