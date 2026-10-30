import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarDays, CheckSquare, Menu } from 'lucide-react'
import { useTareasList } from '../hooks/useTareas'
import { fechaVencimiento, hoyISO } from '../utils/vencimiento'
import { ALTO_BARRA_INFERIOR } from '../hooks/useEsMovil'

// `alsoActive` = rutas que también resaltan la pestaña, como en Sidebar.jsx.
const PESTANAS = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users, alsoActive: ['/nuevo-cliente'] },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays, alsoActive: ['/contenido', '/guiones-del-mes'] },
  { to: '/todo', label: 'Tareas', icon: CheckSquare, badge: true },
]

function rutaCoincide(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

const estiloPestana = {
  flex: 1, minWidth: 0, minHeight: 44, height: ALTO_BARRA_INFERIOR,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
  textDecoration: 'none', background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
}

function Etiqueta({ activa, children }) {
  return (
    <span style={{ fontSize: 10.5, lineHeight: 1, fontWeight: activa ? 600 : 500, color: activa ? 'var(--accent-blue)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// Barra de pestañas fija abajo, solo en móvil (la pinta App.jsx). «Más» abre
// el cajón de la barra lateral con el resto de secciones.
export default function BarraInferiorMovil({ onAbrirMenu }) {
  const location = useLocation()
  const { tareas } = useTareasList()
  const hoy = hoyISO()
  const pendientes = tareas.filter(t => !t.completada && fechaVencimiento(t) && fechaVencimiento(t) <= hoy).length

  const activaDe = (p) => rutaCoincide(location.pathname, p.to) || (p.alsoActive || []).some(r => rutaCoincide(location.pathname, r))
  // «Más» se resalta cuando la página actual no tiene pestaña propia (Dinero, Herramientas…).
  const masActiva = !PESTANAS.some(activaDe)

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--sidebar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-color)',
      }}
    >
      {PESTANAS.map((p) => {
        const activa = activaDe(p)
        const Icon = p.icon
        return (
          <NavLink key={p.to} to={p.to} style={estiloPestana} aria-current={activa ? 'page' : undefined}>
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon size={22} color={activa ? 'var(--accent-blue)' : 'var(--text-secondary)'} strokeWidth={activa ? 2.2 : 1.8} />
              {p.badge && pendientes > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 8, background: '#FF3B30', color: 'white', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxSizing: 'border-box' }}>
                  {pendientes}
                </span>
              )}
            </span>
            <Etiqueta activa={activa}>{p.label}</Etiqueta>
          </NavLink>
        )
      })}
      <button type="button" onClick={onAbrirMenu} aria-label="Más secciones" style={estiloPestana}>
        <Menu size={22} color={masActiva ? 'var(--accent-blue)' : 'var(--text-secondary)'} strokeWidth={masActiva ? 2.2 : 1.8} />
        <Etiqueta activa={masActiva}>Más</Etiqueta>
      </button>
    </nav>
  )
}
