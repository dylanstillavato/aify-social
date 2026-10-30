import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, LayoutGrid, ChevronRight,
  Video, Settings, LogOut, Lightbulb, CheckSquare,
  Sun, Moon, Plus, Repeat, X as XIcon, Search, Wallet,
  BarChart3, CalendarClock, MessageCircle, GalleryVerticalEnd, Inbox
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTareasList } from '../hooks/useTareas'
import { fechaVencimiento, hoyISO } from '../utils/vencimiento'
import { useClientesList } from '../hooks/useClientes'
import faviconIcon from '../assets/favicon-icon.png'
import { abrirPaletaComandos } from './paletaComandosAcciones'
import { useEsMovil } from '../hooks/useEsMovil'

const MAX_CLIENTES_SIDEBAR = 7

const HERRAMIENTAS_KEY = 'aify_sidebar_herramientas'

// Pocos destinos arriba; las herramientas sueltas viven en un grupo plegable.
// `children` = subentradas sangradas; `alsoActive` = rutas que también
// resaltan la entrada (p. ej. /facturas, que sigue existiendo, cuenta como Dinero).
const sections = [
  { items: [
      { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { to: '/clientes', label: 'Clientes', icon: Users, showClientesList: true },
      { to: '/contenido', label: 'Contenido', icon: LayoutGrid, children: [
          { to: '/calendario', label: 'Calendario' },
          { to: '/guiones-del-mes', label: 'Guiones del mes' },
      ]},
      { to: '/dinero', label: 'Dinero', icon: Wallet, alsoActive: ['/facturas'] },
      { to: '/todo', label: 'Tareas', icon: CheckSquare, badge: true },
  ]},
  { label: 'Herramientas', collapsible: true, items: [
      { to: '/guiones', label: 'Ideas y guiones', icon: Video },
      { to: '/lluvia-de-ideas', label: 'Lluvia de ideas', icon: Lightbulb },
      { to: '/investigacion-palabras-clave', label: 'Palabras clave', icon: Search },
      { to: '/instagram/metricas', label: 'Métricas Instagram', icon: BarChart3 },
      { to: '/instagram/programar', label: 'Programar publicaciones', icon: CalendarClock },
      { to: '/instagram/bandeja', label: 'Bandeja de DMs', icon: Inbox },
      { to: '/instagram/dms', label: 'DMs automáticos', icon: MessageCircle },
      { to: '/instagram/historias', label: 'Secuencias de historias', icon: GalleryVerticalEnd },
  ]},
]

function leerHerramientasAbierto() {
  try { return localStorage.getItem(HERRAMIENTAS_KEY) === 'abierto' } catch { return false }
}

function rutaCoincide(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

function SubItemsSidebar({ items }) {
  return (
    <div style={{ margin: '0 0 6px', marginLeft: 22, borderLeft: '1px solid var(--border-color)' }}>
      {items.map(it => (
        <div key={it.to} style={{ padding: '1px 0' }}>
          <ClienteSidebarRow to={it.to} label={it.label} />
        </div>
      ))}
    </div>
  )
}

function ClienteSidebarRow({ to, label }) {
  const [hover, setHover] = useState(false)
  return (
    <NavLink to={to} style={{ textDecoration: 'none', display: 'block' }}>
      {({ isActive }) => (
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: 'relative',
            padding: '5px 10px 5px 14px',
            marginLeft: 18,
            borderRadius: 6,
            // Plain state-driven background instead of whileHover — see the note
            // on the main nav items above about Motion baking in var() pixel values.
            background: isActive ? 'var(--bg-hover)' : hover ? 'var(--bg-hover)' : 'transparent',
            transition: 'background 0.15s ease',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: 12.5,
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              opacity: isActive ? 0.95 : 0.7,
              fontWeight: isActive ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </div>
      )}
    </NavLink>
  )
}

function ClientesSidebarList() {
  const { clientes } = useClientesList()
  const [addHover, setAddHover] = useState(false)
  // Los clientes archivados no se listan en la barra lateral
  const activos = (clientes || []).filter(c => !c.archivado)
  const visibles = activos.slice(0, MAX_CLIENTES_SIDEBAR)

  return (
    <div style={{ margin: '2px 0 6px' }}>
      {visibles.length > 0 && (
        <div style={{ position: 'relative', marginLeft: 22, borderLeft: '1px solid var(--border-color)', paddingLeft: 0 }}>
          {visibles.map(c => (
            <div key={c.id} style={{ padding: '1px 0' }}>
              <ClienteSidebarRow to={`/clientes/${c.id}`} label={c.nombre} />
            </div>
          ))}
        </div>
      )}
      <div
        style={{ marginLeft: visibles.length > 0 ? 22 : 0, borderLeft: visibles.length > 0 ? '1px solid var(--border-color)' : 'none' }}
      >
        <NavLink to="/nuevo-cliente" style={{ textDecoration: 'none', display: 'block' }}>
          <div
            onMouseEnter={() => setAddHover(true)}
            onMouseLeave={() => setAddHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px 5px 14px',
              borderRadius: 6,
              background: addHover ? 'var(--bg-hover)' : 'transparent',
              transition: 'background 0.15s ease',
            }}
          >
            <Plus size={12} color="var(--accent-blue)" strokeWidth={2.2} />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--accent-blue)', opacity: 0.85 }}>
              Añadir cliente
            </span>
          </div>
        </NavLink>
      </div>
    </div>
  )
}

// En móvil (< 820 px) la barra lateral es un cajón que abre la barra superior
// de App.jsx: `abierto` y `onCerrar` solo se usan ahí.
export default function Sidebar({ abierto = false, onCerrar }) {
  const esMovil = useEsMovil()
  const { user, signOut, cuentasGuardadas, cambiarCuenta, olvidarCuenta } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [themeBtnHover, setThemeBtnHover] = useState(false)
  const [hoveredNavTo, setHoveredNavTo] = useState(null)
  const [configHover, setConfigHover] = useState(false)
  const [grupoHover, setGrupoHover] = useState(false)
  const [herramientasAbierto, setHerramientasAbierto] = useState(leerHerramientasAbierto)
  const location = useLocation()

  const toggleHerramientas = () => {
    setHerramientasAbierto(prev => {
      const next = !prev
      try { localStorage.setItem(HERRAMIENTAS_KEY, next ? 'abierto' : 'cerrado') } catch { /* ignore */ }
      return next
    })
  }

  // El tutorial pide desplegar el grupo cuando va a señalar una herramienta.
  useEffect(() => {
    const desplegar = () => setHerramientasAbierto(true)
    window.addEventListener('aify:desplegar-herramientas', desplegar)
    return () => window.removeEventListener('aify:desplegar-herramientas', desplegar)
  }, [])
  const [switchBtnHover, setSwitchBtnHover] = useState(false)
  const [cuentasMenuOpen, setCuentasMenuOpen] = useState(false)
  const [cuentasMenuPos, setCuentasMenuPos] = useState({ left: 0, bottom: 0 })
  const [cuentas, setCuentas] = useState(() => cuentasGuardadas())
  const switchBtnRef = useRef(null)
  const cuentasMenuRef = useRef(null)

  // Cierra el menú de cuentas al hacer click fuera de él (o del botón que lo abre).
  useEffect(() => {
    if (!cuentasMenuOpen) return
    const handleClickOutside = (e) => {
      if (cuentasMenuRef.current?.contains(e.target)) return
      if (switchBtnRef.current?.contains(e.target)) return
      setCuentasMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [cuentasMenuOpen])

  const { tareas: todoTareas } = useTareasList()
  const hoy = hoyISO()
  const todoBadge = todoTareas.filter(t => !t.completada && fechaVencimiento(t) && fechaVencimiento(t) <= hoy).length

  // aify_usuario_perfil es una única clave global en este navegador — con el
  // selector de cuentas, puede quedar cacheada de OTRA cuenta ya usada aquí.
  // Solo se usa si su email coincide con la sesión realmente activa.
  const onboardingPerfil = (() => {
    try {
      const p = JSON.parse(localStorage.getItem('aify_usuario_perfil') || 'null')
      return p && p.email && p.email === user?.email ? p : null
    } catch { return null }
  })()
  const nombre = onboardingPerfil?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Usuario'
  const agencia = onboardingPerfil?.agencia || ''
  const email = user?.email || ''
  const initial = nombre.charAt(0).toUpperCase()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const CUENTAS_MENU_WIDTH = 240

  const handleToggleCuentasMenu = () => {
    if (!cuentasMenuOpen) {
      setCuentas(cuentasGuardadas())
      // El botón vive pegado al borde derecho de una barra lateral de 240px
      // de ancho — anclar el menú (también 240px) con position:absolute +
      // right:0 relativo a ese botón lo hace desbordar por el borde
      // izquierdo de la ventana. Se calcula la posición real del botón y se
      // fija el menú con position:fixed, recortada al viewport, en vez de
      // depender de qué ancestro resulte ser el "positioned" más cercano.
      const rect = switchBtnRef.current?.getBoundingClientRect()
      if (rect) {
        const left = Math.max(8, Math.min(rect.right - CUENTAS_MENU_WIDTH, window.innerWidth - CUENTAS_MENU_WIDTH - 8))
        setCuentasMenuPos({ left, bottom: window.innerHeight - rect.top + 8 })
      }
    }
    setCuentasMenuOpen(o => !o)
  }

  const handleCambiarCuenta = async (cuenta) => {
    const { ok } = await cambiarCuenta(cuenta.refresh_token)
    if (ok) window.location.reload()
  }

  const handleOlvidarCuenta = (e, cuentaEmail) => {
    e.stopPropagation()
    olvidarCuenta(cuentaEmail)
    setCuentas(cs => cs.filter(c => c.email !== cuentaEmail))
  }

  const handleAnadirCuenta = () => {
    setCuentasMenuOpen(false)
    navigate('/login')
  }

  return (
    <>
    {esMovil && (
      <AnimatePresence>
        {abierto && (
          <motion.div
            key="velo-sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCerrar}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199 }}
          />
        )}
      </AnimatePresence>
    )}
    <motion.aside
      initial={esMovil ? false : { x: -20, opacity: 0 }}
      animate={esMovil ? { x: abierto ? 0 : -300 } : { x: 0, opacity: 1 }}
      transition={{ duration: esMovil ? 0.3 : 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      inert={esMovil && !abierto}
      style={{
        width: esMovil ? 280 : 240,
        minWidth: esMovil ? 280 : 240,
        ...(esMovil
          ? { position: 'fixed', top: 0, bottom: 0, left: 0, paddingTop: 'env(safe-area-inset-top)', boxShadow: abierto ? '0 0 40px rgba(0,0,0,0.25)' : 'none' }
          : { height: '100vh', position: 'sticky', top: 0 }),
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        ...(esMovil ? {} : { padding: '0' }),
        zIndex: esMovil ? 200 : 100,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={faviconIcon} alt="Aify" style={{ width: 32, height: 32, borderRadius: 8, filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', lineHeight: 1 }}>Aify <span style={{ color: 'var(--text-secondary)' }}>Social</span></span>
        </div>
      </div>

      {/* Crear: abre la paleta de comandos (Cmd+K) */}
      <div style={{ padding: '12px 10px 0' }}>
        <BotonCrear />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {sections.map((section, sIdx) => {
          // Un grupo plegable se muestra abierto si el usuario lo abrió o si la
          // ruta actual está dentro (sin guardar ese segundo caso).
          const grupoConRutaActiva = section.items.some(it => rutaCoincide(location.pathname, it.to))
          const abierto = !section.collapsible || herramientasAbierto || grupoConRutaActiva
          return (
          <div key={section.label || `section-${sIdx}`}>
            {section.label && !section.collapsible && (
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', padding: '14px 12px 4px' }}>
                {section.label}
              </div>
            )}
            {section.collapsible && (
              <button
                type="button"
                onClick={toggleHerramientas}
                onMouseEnter={() => setGrupoHover(true)}
                onMouseLeave={() => setGrupoHover(false)}
                aria-expanded={abierto}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  margin: '14px 0 4px', padding: '4px 12px', border: 'none', borderRadius: 6,
                  background: grupoHover ? 'var(--bg-hover)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>{section.label}</span>
                <ChevronRight size={13} strokeWidth={2.2} style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
              </button>
            )}
            {abierto && section.items.map(({ to, label, icon: Icon, badge, pronto, showClientesList, children, alsoActive }) => (
              <div key={to}>
                <NavLink
                  to={to}
                  end={to === '/dashboard'}
                  style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
                >
                  {({ isActive: navActive }) => {
                    const isActive = navActive || (alsoActive || []).some(r => rutaCoincide(location.pathname, r))
                    return (
                    <motion.div
                      data-tutorial={
                        to === '/lluvia-de-ideas' ? 'lluvia' :
                        to === '/todo' ? 'todo' :
                        to === '/clientes' ? 'clientes' :
                        to === '/guiones' ? 'guiones' :
                        undefined
                      }
                      onMouseEnter={() => setHoveredNavTo(to)}
                      onMouseLeave={() => setHoveredNavTo(null)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10,
                        // Plain state-driven background, not Framer Motion's whileHover — see
                        // the theme-toggle button above for why animating a var() this way
                        // gets permanently stuck on whichever theme was active at first hover.
                        background: isActive ? 'rgba(29,95,224,0.1)' : hoveredNavTo === to ? 'var(--bg-hover)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent-lime)' : '3px solid transparent',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <Icon size={17} color={isActive ? 'var(--accent-blue)' : 'var(--text-secondary)'} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)', letterSpacing: '-0.1px' }}>
                        {label}
                      </span>
                      {badge && todoBadge > 0 && (
                        <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#FF3B30', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                          {todoBadge}
                        </span>
                      )}
                      {pronto && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 10, letterSpacing: '0.2px', textTransform: 'uppercase' }}>
                          Pronto
                        </span>
                      )}
                    </motion.div>
                    )
                  }}
                </NavLink>
                {showClientesList && <ClientesSidebarList />}
                {children && <SubItemsSidebar items={children} />}
              </div>
            ))}
          </div>
          )
        })}
      </nav>

      {/* Bottom: Settings + User */}
      <div style={{ padding: '10px 10px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <NavLink to="/configuracion" style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
          {({ isActive }) => (
            <motion.div
              onMouseEnter={() => setConfigHover(true)}
              onMouseLeave={() => setConfigHover(false)}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10,
                background: isActive ? 'rgba(29,95,224,0.1)' : configHover ? 'var(--bg-hover)' : 'transparent',
              }}
            >
              <Settings size={17} color={isActive ? 'var(--accent-blue)' : 'var(--text-secondary)'} strokeWidth={1.8} />
              <span style={{ fontSize: 14, fontWeight: 400, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                Configuración
              </span>
            </motion.div>
          )}
        </NavLink>

        {/* Theme toggle */}
        <motion.button
          onMouseEnter={() => setThemeBtnHover(true)}
          onMouseLeave={() => setThemeBtnHover(false)}
          whileTap={{ scale: 0.97 }}
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10, marginBottom: 8,
            border: '1px solid var(--border-color)',
            // Plain React state instead of Framer Motion's whileHover here — Motion
            // bakes in the *resolved pixel value* of a CSS var() the first time it
            // animates it and never re-reads it, so after a theme switch this would
            // get stuck showing the previous theme's color regardless of `theme`.
            background: themeBtnHover ? 'var(--bg-hover)' : 'var(--bg-secondary)',
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 400, fontFamily: 'inherit',
            width: '100%', transition: 'background 0.2s',
          }}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
        </motion.button>

        {/* User info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nombre}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agencia || email}
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <motion.button
              ref={switchBtnRef}
              onMouseEnter={() => setSwitchBtnHover(true)}
              onMouseLeave={() => setSwitchBtnHover(false)}
              whileTap={{ scale: 0.92 }}
              onClick={handleToggleCuentasMenu}
              title="Cambiar de cuenta"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                // Plain React state instead of Framer Motion's whileHover — mismo
                // motivo que el botón de tema más arriba (var() se congela al
                // cambiar de tema si Motion la anima).
                color: switchBtnHover ? 'var(--text-primary)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
                transition: 'color 0.15s ease',
              }}
            >
              <Repeat size={15} />
            </motion.button>

            {cuentasMenuOpen && (
              <div
                ref={cuentasMenuRef}
                style={{
                  position: 'fixed', bottom: cuentasMenuPos.bottom, left: cuentasMenuPos.left,
                  width: CUENTAS_MENU_WIDTH, background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)', borderRadius: 12,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000,
                  padding: 6, maxHeight: 280, overflowY: 'auto',
                }}
              >
                {cuentas.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)', padding: '6px 8px 4px' }}>
                    Cuentas guardadas
                  </div>
                )}
                {cuentas.map(c => (
                  <CuentaMenuRow
                    key={c.email}
                    cuenta={c}
                    onSelect={handleCambiarCuenta}
                    onForget={handleOlvidarCuenta}
                  />
                ))}
                <AnadirCuentaRow onClick={handleAnadirCuenta} />
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ color: '#FF3B30' }}
            whileTap={{ scale: 0.92 }}
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, flexShrink: 0 }}
          >
            <LogOut size={15} />
          </motion.button>
        </div>
      </div>
    </motion.aside>
    </>
  )
}

function CuentaMenuRow({ cuenta, onSelect, onForget }) {
  const [hover, setHover] = useState(false)
  const [xHover, setXHover] = useState(false)
  const inicial = cuenta.email.charAt(0).toUpperCase()
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(cuenta)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: 'white', flexShrink: 0,
      }}>
        {inicial}
      </div>
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cuenta.email}
      </span>
      <span
        onMouseEnter={() => setXHover(true)}
        onMouseLeave={() => setXHover(false)}
        onClick={(e) => onForget(e, cuenta.email)}
        title="Olvidar esta cuenta"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          color: xHover ? '#FF3B30' : 'var(--text-secondary)',
          background: xHover ? 'rgba(255,59,48,0.1)' : 'transparent',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
      >
        <XIcon size={11} />
      </span>
    </div>
  )
}

function AnadirCuentaRow({ onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px', borderRadius: 8, cursor: 'pointer', marginTop: 2,
        background: hover ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <Plus size={13} color="var(--accent-blue)" strokeWidth={2.2} />
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--accent-blue)' }}>
        Añadir otra cuenta
      </span>
    </div>
  )
}

const ES_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

function BotonCrear() {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={abrirPaletaComandos}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-keyshortcuts={ES_MAC ? 'Meta+K' : 'Control+K'}
      title="Crear o buscar"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#D7FF3D', color: '#0B0C10',
        fontSize: 14, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.1px',
        filter: hover ? 'brightness(0.95)' : 'none',
        transition: 'filter 0.15s ease',
      }}
    >
      <Plus size={16} strokeWidth={2.4} />
      <span style={{ flex: 1, textAlign: 'left' }}>Crear</span>
      <kbd style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
        padding: '2px 6px', borderRadius: 5,
        background: 'rgba(11,12,16,0.1)', color: 'rgba(11,12,16,0.7)',
      }}>
        {ES_MAC ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}
