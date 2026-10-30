import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, MoreHorizontal, Edit3, Copy, Download, Trash2, ChevronDown, Zap, AlertCircle, Send, LayoutGrid, Columns3, UserRound } from 'lucide-react'
import { useClientesList, eliminarCliente, duplicarCliente } from '../hooks/useClientes'
import { useTablero, moverCliente, acabaDeArrastrar } from '../hooks/useTableros'
import Kanban from '../components/Kanban'
import { SkeletonClienteCard } from '../components/Skeleton'
import EnviarFormularioModal from '../components/EnviarFormularioModal'
import { esMarcaPersonal, SECTOR_MARCA_PERSONAL, COLOR_MARCA_PERSONAL } from '../utils/marcaPersonal'
import { useEsMovil } from '../hooks/useEsMovil'


const redColors = {
  instagram: '#E1306C', tiktok: '#86868B', facebook: '#1877F2',
  youtube: '#FF0000', whatsapp: '#25D366', googlemaps: '#EA4335',
}

const redLabels = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}

const sectorColors = {
  'Restauración': '#FF9500', 'Moda': '#3D9BFF', 'Fitness': '#30D158',
  'Belleza': '#FF2D55', 'Retail': '#1D5FE0', 'Servicios': '#64D2FF',
  'Educación': '#FF9500', 'Tecnología': '#3D9BFF', 'Otro': '#86868B',
  [SECTOR_MARCA_PERSONAL]: COLOR_MARCA_PERSONAL,
}

const SECTORES_FILTRO = ['Todos', 'Restauración', 'Moda', 'Fitness', 'Belleza', 'Retail', 'Servicios', 'Educación', 'Tecnología', 'Otro', SECTOR_MARCA_PERSONAL]

function isInactivo(cliente) {
  const ua = (cliente.ultimaActividad || '').toLowerCase()
  return ua.includes('mes') || ua.includes('semana') && ua.includes('hace 4') || ua.includes('hace 5') || ua.includes('hace 6')
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmEliminar({ cliente, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 20, padding: '28px 28px 24px',
          maxWidth: 380, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(255,59,48,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Trash2 size={20} color="#FF3B30" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 8 }}>
          ¿Eliminar a {cliente.nombre}?
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Se eliminará el cliente y todo su contenido generado. Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: 12,
              background: 'rgba(0,0,0,0.06)', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          >
            Cancelar
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px', borderRadius: 12,
              background: '#FF3B30', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              color: 'white', fontFamily: 'inherit',
            }}
          >
            Eliminar
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Client card menu ─────────────────────────────────────────────────────────

function CardMenu({ onClose, onEditar, onDuplicar, onExportar, onEliminar }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const items = [
    { icon: Edit3, label: 'Editar cliente', action: onEditar },
    { icon: Copy, label: 'Duplicar cliente', action: onDuplicar },
    { icon: Download, label: 'Exportar datos', action: onExportar },
  ]

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute', top: 36, right: 0, zIndex: 200,
        background: 'var(--bg-card)', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        border: '1px solid var(--border-color)',
        minWidth: 190, overflow: 'hidden',
      }}
    >
      {items.map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); action() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '11px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
            textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <Icon size={14} color="#86868B" /> {label}
        </button>
      ))}
      <button
        onClick={(e) => { e.stopPropagation(); onEliminar() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '11px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#FF3B30', fontFamily: 'inherit', textAlign: 'left',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <Trash2 size={14} color="#FF3B30" /> Eliminar cliente
      </button>
    </motion.div>
  )
}

// ─── Tablero de clientes ──────────────────────────────────────────────────────
// Cada cliente es una tarjeta que se mueve a mano entre etapas (Presupuesto
// enviado → ... → Pagado). Columnas editables; migración 0024_tableros.sql.

const VISTA_KEY = 'aify_clientes_vista'

function leerVista() {
  try { return localStorage.getItem(VISTA_KEY) === 'tablero' ? 'tablero' : 'tarjetas' } catch { return 'tarjetas' }
}

function formatoCuota(n) {
  return `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/mes`
}

function TarjetaClienteTablero({ cliente, arrastrando, onAbrir }) {
  const color = cliente.color || '#1D5FE0'
  return (
    <div
      onClick={() => { if (!acabaDeArrastrar()) onAbrir(cliente) }}
      style={{
        background: 'var(--bg-card)', borderRadius: 11, padding: '10px 12px',
        border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: arrastrando ? '0 12px 32px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
      }}>
      {cliente.fotoUrl ? (
        <img src={cliente.fotoUrl} alt="" draggable={false}
          style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color }}>
          {(cliente.nombre || '?').charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cliente.nombre}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          {cliente.sector && <span style={{ color: sectorColors[cliente.sector] || 'var(--text-secondary)', fontWeight: 500 }}>{cliente.sector}</span>}
          {cliente.cuotaMensual != null && cliente.cuotaMensual > 0 && <span>{formatoCuota(cliente.cuotaMensual)}</span>}
        </div>
      </div>
    </div>
  )
}

function TableroClientes({ clientes, refetch, onAbrir }) {
  const tablero = useTablero('clientes')
  const { columnas } = tablero

  if (tablero.loading) return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando tablero...</p>
  if (!tablero.editable) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,149,0,0.1)', color: 'var(--text-primary)', fontSize: 13 }}>
        <AlertCircle size={16} color="#FF9500" />
        {tablero.sinMigracion
          ? 'Actualiza la base de datos para usar los tableros.'
          : 'No se pudieron cargar las columnas del tablero. Vuelve a intentarlo en un momento.'}
      </div>
    )
  }

  // Cliente sin etapa (nuevo o anterior al tablero) → primera columna
  const grupos = Object.fromEntries(columnas.map(c => [c.id, []]))
  clientes.forEach(c => {
    const col = columnas.find(x => String(x.id) === String(c.etapaId)) || columnas[0]
    grupos[col.id].push(c)
  })
  Object.values(grupos).forEach(arr => arr.sort((a, b) =>
    (a.etapaOrden ?? Infinity) - (b.etapaOrden ?? Infinity) || (a.nombre || '').localeCompare(b.nombre || '')))

  return (
    <Kanban
      columnas={columnas}
      grupos={grupos}
      onMover={async (_cliente, columna, idsOrdenados) => {
        await moverCliente({ columna, idsOrdenados, clientes })
        await refetch?.()
      }}
      onRenombrarColumna={tablero.renombrarColumna}
      onColorColumna={tablero.cambiarColorColumna}
      onMoverColumna={tablero.moverColumna}
      onEliminarColumna={async (id) => { await tablero.eliminarColumna(id); await refetch?.() }}
      onCrearColumna={tablero.crearColumna}
      renderTarjeta={(c, opts) => <TarjetaClienteTablero cliente={c} arrastrando={!!opts?.arrastrando} onAbrir={onAbrir} />}
    />
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Clientes() {
  const navigate = useNavigate()
  const esMovil = useEsMovil()
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [filtroSector, setFiltroSector] = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [ordenar, setOrdenar] = useState('reciente')
  const [showSectorDrop, setShowSectorDrop] = useState(false)
  const [showOrdenarDrop, setShowOrdenarDrop] = useState(false)
  const { clientes, loading, refetch } = useClientesList()
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [vista, setVista] = useState(leerVista)
  const cambiarVista = (v) => {
    setVista(v)
    try { localStorage.setItem(VISTA_KEY, v) } catch { /* sin almacenamiento: solo esta sesión */ }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setShowSectorDrop(false); setShowOrdenarDrop(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleEditar = (cliente) => {
    setMenuAbierto(null)
    navigate('/nuevo-cliente', { state: { cliente } })
  }

  const handleDuplicar = async (cliente) => {
    setMenuAbierto(null)
    await duplicarCliente(cliente.id)
    refetch?.()
  }

  const handleExportar = (cliente) => {
    setMenuAbierto(null)
    const blob = new Blob([JSON.stringify(cliente, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${cliente.nombre.replace(/\s+/g, '_')}_datos.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleEliminar = async () => {
    if (!confirmarEliminar) return
    await eliminarCliente(confirmarEliminar.id)
    setConfirmarEliminar(null)
    refetch?.()
  }

  let filtrados = clientes.filter(c => {
    const matchSearch = (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.sector || '').toLowerCase().includes(search.toLowerCase())
    const matchSector = filtroSector === 'Todos' || c.sector === filtroSector
    const isArchivado = !!c.archivado
    const matchEstado = filtroEstado === 'todos' || (filtroEstado === 'archivados' ? isArchivado : !isArchivado)
    return matchSearch && matchSector && matchEstado
  })

  if (ordenar === 'nombre') filtrados = [...filtrados].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
  else if (ordenar === 'posts') filtrados = [...filtrados].sort((a, b) => (b.postsEsteMes || 0) - (a.postsEsteMes || 0))

  // El tablero muestra siempre los activos (sin archivados), con búsqueda y sector
  const clientesTablero = clientes.filter(c => {
    if (c.archivado) return false
    const matchSearch = (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.sector || '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filtroSector === 'Todos' || c.sector === filtroSector)
  })

  const estadoBtns = [
    { id: 'todos', label: 'Todos' },
    { id: 'activos', label: 'Activos' },
    { id: 'archivados', label: 'Archivados' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className={esMovil ? 'pagina-movil' : undefined}
      style={{ padding: esMovil ? '20px 16px' : '36px 40px', flex: 1, overflowY: 'auto' }}
      onClick={() => setMenuAbierto(null)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, ...(esMovil ? { flexWrap: 'wrap', gap: 14 } : {}) }}>
        <div>
          <h1 style={{ fontSize: esMovil ? 26 : 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.8px', marginBottom: 4 }}>
            Mis Clientes
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            {loading ? '–' : `${clientes.filter(c => !c.archivado).length} clientes activos`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: esMovil ? 'wrap' : 'nowrap' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={(e) => { e.stopPropagation(); setFormularioAbierto(true) }}
          title="Manda a tu cliente un enlace para que rellene él mismo el onboarding"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 18px', borderRadius: 12,
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1.5px solid var(--border-color)', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          <Send size={15} /> Enviar formulario
        </motion.button>
        {!clientes.some(esMarcaPersonal) && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/nuevo-cliente', { state: { marcaPersonal: true } })}
            title="Tu propia cuenta, con contenido para conseguir clientes para tu negocio"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 12,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              border: '1.5px solid var(--border-color)', cursor: 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <UserRound size={15} /> Mi marca personal
          </motion.button>
        )}
        <motion.button
          whileHover={{ backgroundColor: '#1850BE' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/nuevo-cliente')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12,
            background: '#1D5FE0', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
            boxShadow: '0 2px 12px rgba(29,95,224,0.3)',
            transition: 'background 0.2s ease', fontFamily: 'inherit',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Nuevo Cliente
        </motion.button>
        </div>
      </div>

      <EnviarFormularioModal open={formularioAbierto} onClose={() => setFormularioAbierto(false)} />

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: esMovil ? '1 1 100%' : '0 0 280px' }}>
          <Search size={15} color="#86868B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar clientes..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)',
              background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Vista */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '3px', borderRadius: 10 }}>
          {[
            { id: 'tarjetas', label: 'Tarjetas', Icon: LayoutGrid },
            { id: 'tablero', label: 'Tablero', Icon: Columns3 },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => cambiarVista(v.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit', transition: 'all 0.15s',
                background: vista === v.id ? 'var(--bg-card)' : 'transparent',
                color: vista === v.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: vista === v.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <v.Icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        {/* Estado filter */}
        {vista === 'tarjetas' && (
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '3px', borderRadius: 10 }}>
          {estadoBtns.map(b => (
            <button
              key={b.id}
              onClick={() => setFiltroEstado(b.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit', transition: 'all 0.15s',
                background: filtroEstado === b.id ? 'white' : 'transparent',
                color: filtroEstado === b.id ? '#1D1D1F' : '#86868B',
                boxShadow: filtroEstado === b.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        )}

        {/* Sector dropdown */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setShowSectorDrop(v => !v); setShowOrdenarDrop(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: filtroSector !== 'Todos' ? 'rgba(29,95,224,0.08)' : 'white',
              border: `1px solid ${filtroSector !== 'Todos' ? 'rgba(29,95,224,0.3)' : 'rgba(0,0,0,0.1)'}`,
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: filtroSector !== 'Todos' ? '#1D5FE0' : '#1D1D1F',
              fontFamily: 'inherit',
            }}
          >
            Sector: {filtroSector} <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showSectorDrop && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                style={{
                  position: 'absolute', top: 38, left: 0, zIndex: 100,
                  background: 'var(--bg-card)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden', minWidth: 160,
                }}
              >
                {SECTORES_FILTRO.map(s => (
                  <button
                    key={s}
                    onClick={() => { setFiltroSector(s); setShowSectorDrop(false) }}
                    style={{
                      display: 'block', width: '100%', padding: '9px 14px',
                      background: filtroSector === s ? 'rgba(29,95,224,0.06)' : 'none',
                      border: 'none', cursor: 'pointer', fontSize: 13,
                      color: filtroSector === s ? '#1D5FE0' : '#1D1D1F',
                      fontFamily: 'inherit', textAlign: 'left', fontWeight: filtroSector === s ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (filtroSector !== s) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { if (filtroSector !== s) e.currentTarget.style.background = 'none' }}
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ordenar dropdown */}
        {vista === 'tarjetas' && (
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setShowOrdenarDrop(v => !v); setShowSectorDrop(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: 'var(--bg-card)', border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          >
            Ordenar <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showOrdenarDrop && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                style={{
                  position: 'absolute', top: 38, left: 0, zIndex: 100,
                  background: 'var(--bg-card)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden', minWidth: 150,
                }}
              >
                {[['reciente', 'Más reciente'], ['nombre', 'Nombre A-Z'], ['posts', 'Más posts']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => { setOrdenar(id); setShowOrdenarDrop(false) }}
                    style={{
                      display: 'block', width: '100%', padding: '9px 14px',
                      background: ordenar === id ? 'rgba(29,95,224,0.06)' : 'none',
                      border: 'none', cursor: 'pointer', fontSize: 13,
                      color: ordenar === id ? '#1D5FE0' : '#1D1D1F',
                      fontFamily: 'inherit', textAlign: 'left', fontWeight: ordenar === id ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (ordenar !== id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { if (ordenar !== id) e.currentTarget.style.background = 'none' }}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>

      {vista === 'tablero' && (
        loading
          ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando clientes...</p>
          : <TableroClientes clientes={clientesTablero} refetch={refetch} onAbrir={(c) => navigate(`/clientes/${c.id}`)} />
      )}

      {/* Grid */}
      {vista === 'tarjetas' && (
      <div style={{ display: 'grid', gridTemplateColumns: esMovil ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: esMovil ? 14 : 18 }}>
        {loading && [0, 1, 2].map(i => <SkeletonClienteCard key={i} />)}
        <AnimatePresence>
          {!loading && filtrados.map((cliente) => (
            <motion.div
              key={cliente.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              onHoverStart={() => setHoveredId(cliente.id)}
              onHoverEnd={() => setHoveredId(null)}
              style={{
                background: 'var(--bg-card)', borderRadius: 20, padding: '22px',
                boxShadow: hoveredId === cliente.id ? '0 12px 44px rgba(0,0,0,0.13)' : '0 2px 20px rgba(0,0,0,0.06)',
                border: `1px solid ${cliente.archivado ? 'var(--border-color)' : 'var(--border-subtle)'}`,
                cursor: 'pointer', transition: 'box-shadow 0.3s ease',
                transform: hoveredId === cliente.id ? 'translateY(-2px)' : 'translateY(0)',
                opacity: cliente.archivado ? 0.65 : 1, position: 'relative',
              }}
              onClick={() => navigate(`/clientes/${cliente.id}`)}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                    background: `${cliente.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 19, fontWeight: 700, color: cliente.color,
                    border: `1px solid ${cliente.color}25`,
                  }}>
                    {(cliente.nombre || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                      {cliente.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                        background: `${sectorColors[cliente.sector] || '#86868B'}15`,
                        color: sectorColors[cliente.sector] || '#86868B',
                      }}>
                        {cliente.sector}
                      </span>
                      {cliente.perfilComunicacion && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: 'rgba(48,209,88,0.12)', color: '#30D158',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <Zap size={9} /> IA
                        </span>
                      )}
                      {isInactivo(cliente) && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                        }}>
                          Inactivo
                        </span>
                      )}
                      {cliente.archivado && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: 'rgba(0,0,0,0.07)', color: 'var(--text-secondary)',
                        }}>
                          Archivado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3-dot menu */}
                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMenuAbierto(menuAbierto === cliente.id ? null : cliente.id)}
                    style={{
                      background: menuAbierto === cliente.id ? 'rgba(0,0,0,0.06)' : 'none',
                      border: 'none', cursor: 'pointer',
                      padding: '4px 6px', borderRadius: 8, color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </motion.button>
                  <AnimatePresence>
                    {menuAbierto === cliente.id && (
                      <CardMenu
                        onClose={() => setMenuAbierto(null)}
                        onEditar={() => handleEditar(cliente)}
                        onDuplicar={() => handleDuplicar(cliente)}
                        onExportar={() => handleExportar(cliente)}
                        onEliminar={() => { setMenuAbierto(null); setConfirmarEliminar(cliente) }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Redes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                {(cliente.redes || []).map(red => (
                  <span key={red} style={{
                    fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20,
                    background: `${redColors[red] || '#86868B'}12`,
                    color: redColors[red] || '#86868B',
                    border: `1px solid ${redColors[red] || '#86868B'}25`,
                  }}>
                    {redLabels[red] || red}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Última actividad</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginTop: 1 }}>
                    {cliente.ultimaActividad || '–'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)',
                    background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: 8,
                  }}>
                    {cliente.postsEsteMes || 0} posts
                  </div>
                  <ChevronRight size={14} color="#86868B" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add new card */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            whileHover={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/nuevo-cliente')}
            style={{
              background: 'rgba(29,95,224,0.04)', borderRadius: 20, padding: '22px',
              border: '2px dashed rgba(29,95,224,0.25)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: 200, gap: 10,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(29,95,224,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={20} color="#1D5FE0" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#1D5FE0', textAlign: 'center' }}>
              Añadir nuevo cliente
            </span>
          </motion.div>
        )}
      </div>
      )}

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmarEliminar && (
          <ConfirmEliminar
            cliente={confirmarEliminar}
            onConfirm={handleEliminar}
            onCancel={() => setConfirmarEliminar(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
